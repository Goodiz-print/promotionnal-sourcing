import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import BillingProfile from '#models/billing_profile'
import type Organization from '#models/organization'
import type OrganizationSubscription from '#models/organization_subscription'
import StripeWebhookEventService from '#services/stripe_webhook_event_service'
import SubscriptionAlertService from '#services/subscription_alert_service'
import SubscriptionService from '#services/subscription_service'
import SubscriptionBillingGateway from '#services/subscriptions/subscription_billing_gateway'
import {
  BillingPortalUnavailableException,
  SubscriptionAlreadyActiveException,
  SubscriptionPaymentPendingException,
  SubscriptionSyncConflictException,
} from '#exceptions/subscription_errors'
import {
  CURRENT_SUBSCRIPTION_STATUSES,
  type BillingSubscriptionSnapshot,
  type PaidSubscriptionPlan,
  type SubscriptionSyncResult,
} from '#shared/types/subscription'

/**
 * Souscription en ligne des abonnements (cf. `docs/abonnements.md`) : client
 * Stripe de l'organisation, page de souscription, portail de facturation et
 * notifications. La formule n'est jamais accordée au retour du navigateur :
 * seulement à la notification signée, après relecture de l'abonnement.
 */
@inject()
export default class SubscriptionBillingService {
  constructor(
    private gateway: SubscriptionBillingGateway,
    private subscriptions: SubscriptionService,
    private events: StripeWebhookEventService,
    private alerts: SubscriptionAlertService
  ) {}

  /** La souscription en ligne est-elle proposée ? */
  get enabled(): boolean {
    return this.gateway.enabled
  }

  /** L'organisation a-t-elle un client Stripe (portail de facturation accessible) ? */
  async hasBillingAccount(organizationId: number): Promise<boolean> {
    const profile = await BillingProfile.findBy('organizationId', organizationId)
    return Boolean(profile?.stripeCustomerId)
  }

  /**
   * URL de la page de souscription hébergée. Refuse si un abonnement est déjà
   * en cours (changer de formule passe par le portail, pas par un second
   * abonnement) ou si un premier paiement est encore en validation (il peut
   * aboutir : un second ferait payer deux abonnements).
   */
  async checkoutUrl(
    organization: Organization,
    plan: PaidSubscriptionPlan,
    urls: { successUrl: string; cancelUrl: string; fallbackEmail: string | null }
  ): Promise<string> {
    const blocking = await this.subscriptions.blocking(organization.id)
    if (blocking?.status === 'pending') throw new SubscriptionPaymentPendingException()
    if (blocking) throw new SubscriptionAlreadyActiveException()
    const customerId = await this.ensureCustomer(organization, urls.fallbackEmail)
    return this.gateway.createCheckout({
      organizationId: organization.id,
      customerId,
      plan,
      successUrl: urls.successUrl,
      cancelUrl: urls.cancelUrl,
    })
  }

  /** URL du portail de facturation (changement de formule, résiliation, factures). */
  async portalUrl(organization: Organization, returnUrl: string): Promise<string> {
    const profile = await BillingProfile.findBy('organizationId', organization.id)
    if (!profile?.stripeCustomerId) throw new BillingPortalUnavailableException()
    return this.gateway.createPortalSession(profile.stripeCustomerId, returnUrl)
  }

  /**
   * Notification du prestataire. **Idempotent** : l'identifiant de l'événement
   * est enregistré dans la même transaction que la mise à jour — une
   * notification rejouée est ignorée, et une mise à jour en échec laisse
   * Stripe la renvoyer. L'abonnement est **relu** chez le prestataire plutôt que
   * déduit de la notification : l'ordre d'arrivée n'importe pas. La relecture
   * se fait **avant** la transaction, pour ne pas la garder ouverte pendant
   * l'appel réseau. Lève si la signature est invalide.
   */
  async handleWebhook(rawBody: string, signature: string | undefined): Promise<void> {
    const event = await this.gateway.parseWebhook(rawBody, signature)
    if (!event) return
    if (await this.events.isProcessed(event.id)) {
      logger.info({ eventId: event.id }, 'subscription webhook already processed')
      return
    }

    const snapshot = await this.gateway.fetchSubscription(event.subscriptionId)
    await db.transaction(async (trx) => {
      // Traitement concurrent de la même notification : le premier l'emporte.
      if (!(await this.events.record(event, trx))) return

      const subscription = await this.sync(snapshot, trx)
      logger.info(
        {
          eventId: event.id,
          type: event.type,
          organizationId: subscription?.organizationId,
          status: subscription?.status,
        },
        'subscription synced from billing'
      )
    })
  }

  /**
   * Aligne l'abonnement local et arbitre un **doublon** : l'organisation a déjà
   * un autre abonnement en ligne en cours (deux pages de souscription payées en
   * parallèle, par exemple). L'autre abonnement est d'abord relu chez Stripe :
   * s'il n'est plus en cours (résiliation dont la notification n'est pas encore
   * arrivée), il est clos et le nouveau prend sa place. Sinon l'abonnement déjà
   * en place est gardé et le nouveau est **résilié chez Stripe** — sans quoi les
   * deux seraient facturés. Son paiement est à rembourser depuis le tableau de
   * bord : les administrateurs de la plateforme en sont **notifiés** (in-app).
   *
   * La notification part dès la résiliation faite, hors transaction (connexion
   * par défaut) : la résiliation est acquise chez Stripe même si la transaction
   * échoue ensuite, et le renvoi de la notification, qui verra alors
   * l'abonnement résilié, ne repasserait pas par ce chemin.
   *
   * Appels réseau dans la transaction : chemin rare, et un échec annule tout
   * pour que Stripe renvoie la notification.
   */
  private async sync(
    snapshot: BillingSubscriptionSnapshot,
    trx: TransactionClientContract
  ): Promise<OrganizationSubscription | null> {
    const result = await this.subscriptions.syncFromBilling(snapshot, trx)
    if (result.outcome !== 'conflict') return syncedRow(result)

    const kept = result.current
    const keptResult = await this.subscriptions.syncFromBilling(
      await this.gateway.fetchSubscription(kept.stripeSubscriptionId),
      trx
    )
    const keptRow = syncedRow(keptResult)
    if (keptRow && !CURRENT_SUBSCRIPTION_STATUSES.includes(keptRow.status)) {
      // L'abonnement en place n'est plus en cours chez Stripe : le nouveau le remplace.
      return syncedRow(await this.resolved(snapshot, trx))
    }

    const cancelled = await this.gateway.cancelSubscription(snapshot.id)
    const duplicate = {
      organizationId: kept.organizationId,
      keptSubscriptionId: kept.stripeSubscriptionId,
      cancelledSubscriptionId: snapshot.id,
    }
    logger.error(
      duplicate,
      'duplicate online subscription cancelled at Stripe: refund the payment from the dashboard'
    )
    await this.alerts.duplicateCancelled(duplicate)
    return syncedRow(await this.resolved(cancelled, trx))
  }

  /** Second alignement, après arbitrage : un nouveau conflit est une incohérence. */
  private async resolved(
    snapshot: BillingSubscriptionSnapshot,
    trx: TransactionClientContract
  ): Promise<SubscriptionSyncResult<OrganizationSubscription>> {
    const result = await this.subscriptions.syncFromBilling(snapshot, trx)
    if (result.outcome === 'conflict') throw new SubscriptionSyncConflictException()
    return result
  }

  /**
   * Client Stripe de l'organisation, créé à la première souscription et
   * conservé dans `billing_profiles.stripe_customer_id`. Le profil est
   * verrouillé le temps de la création : deux clics simultanés ne créent pas
   * deux clients.
   */
  private async ensureCustomer(
    organization: Organization,
    fallbackEmail: string | null
  ): Promise<string> {
    await BillingProfile.firstOrCreate({ organizationId: organization.id }, {})

    return db.transaction(async (trx) => {
      const profile = await BillingProfile.query({ client: trx })
        .where('organizationId', organization.id)
        .forUpdate()
        .firstOrFail()
      if (profile.stripeCustomerId) return profile.stripeCustomerId

      const customerId = await this.gateway.createCustomer({
        organizationId: organization.id,
        name: organization.name,
        email: profile.email ?? organization.email ?? fallbackEmail,
      })
      profile.stripeCustomerId = customerId
      await profile.useTransaction(trx).save()
      return customerId
    })
  }
}

function syncedRow(
  result: SubscriptionSyncResult<OrganizationSubscription>
): OrganizationSubscription | null {
  return result.outcome === 'synced' ? result.subscription : null
}
