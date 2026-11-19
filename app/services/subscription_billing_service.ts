import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import BillingProfile from '#models/billing_profile'
import type Organization from '#models/organization'
import SubscriptionService from '#services/subscription_service'
import SubscriptionBillingGateway from '#services/subscriptions/subscription_billing_gateway'
import {
  BillingPortalUnavailableException,
  SubscriptionAlreadyActiveException,
} from '#exceptions/subscription_errors'
import type { PaidSubscriptionPlan } from '#shared/types/subscription'

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
    private subscriptions: SubscriptionService
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
   * en cours : changer de formule passe par le portail, pas par un second abonnement.
   */
  async checkoutUrl(
    organization: Organization,
    plan: PaidSubscriptionPlan,
    urls: { successUrl: string; cancelUrl: string; fallbackEmail: string | null }
  ): Promise<string> {
    if (await this.subscriptions.current(organization.id)) {
      throw new SubscriptionAlreadyActiveException()
    }
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
   * déduit de la notification : l'ordre d'arrivée n'importe pas.
   * Lève si la signature est invalide.
   */
  async handleWebhook(rawBody: string, signature: string | undefined): Promise<void> {
    const event = await this.gateway.parseWebhook(rawBody, signature)
    if (!event) return

    await db.transaction(async (trx) => {
      const inserted = await trx
        .insertQuery()
        .table('stripe_webhook_events')
        .insert({ event_id: event.id, type: event.type, created_at: new Date() })
        .onConflict('event_id')
        .ignore()
        .returning('id')
      if (inserted.length === 0) {
        logger.info({ eventId: event.id }, 'subscription webhook already processed')
        return
      }

      const snapshot = await this.gateway.fetchSubscription(event.subscriptionId)
      const subscription = await this.subscriptions.syncFromBilling(snapshot, trx)
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
