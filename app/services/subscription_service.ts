import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import BillingProfile from '#models/billing_profile'
import Organization from '#models/organization'
import OrganizationSubscription from '#models/organization_subscription'
import SubscriptionPlanService, {
  whereCurrentSubscription,
} from '#services/subscription_plan_service'
import { statusFromProvider } from '#shared/helpers/subscription'
import {
  BLOCKING_SUBSCRIPTION_STATUSES,
  CURRENT_SUBSCRIPTION_STATUSES,
  type BillingSubscriptionSnapshot,
  type SubscriptionSyncResult,
} from '#shared/types/subscription'

/**
 * Abonnements des organisations (cf. `docs/abonnements.md`). Seul point qui
 * répond à « abonné ou non » ; la règle elle-même (`whereCurrentSubscription`)
 * et l'écriture de `organizations.subscription_plan` vivent dans
 * `SubscriptionPlanService`, sans modèle Lucid, pour servir aussi aux jobs.
 */
@inject()
export default class SubscriptionService {
  constructor(private plans: SubscriptionPlanService) {}

  /** Abonnement en cours de l'organisation, s'il existe (cf. `whereCurrentSubscription`). */
  current(
    organizationId: number,
    client?: TransactionClientContract
  ): Promise<OrganizationSubscription | null> {
    return whereCurrentSubscription(OrganizationSubscription.query({ client }))
      .where('organizationId', organizationId)
      .first()
  }

  /**
   * Abonnement qui interdit d'en souscrire un autre : en cours, ou premier
   * paiement encore en validation (`pending`).
   */
  blocking(organizationId: number): Promise<OrganizationSubscription | null> {
    return OrganizationSubscription.query()
      .where('organizationId', organizationId)
      .whereIn('status', [...BLOCKING_SUBSCRIPTION_STATUSES])
      .first()
  }

  /** L'organisation a-t-elle un abonnement payant en cours, à l'instant de la lecture ? */
  async isSubscribed(organizationId: number): Promise<boolean> {
    return (await this.current(organizationId)) !== null
  }

  /**
   * `isSubscribed` pour plusieurs organisations en une requête : les
   * identifiants de celles qui ont un abonnement payant en cours.
   */
  subscribedAmong(
    organizationIds: number[],
    client?: TransactionClientContract
  ): Promise<Set<number>> {
    return this.plans.subscribedAmong(organizationIds, client)
  }

  /**
   * Aligne l'abonnement local sur l'état relu chez le prestataire, puis la
   * formule courante de l'organisation. **Idempotent** : la ligne est retrouvée
   * par `stripe_subscription_id`, un état rejoué ne change rien.
   *
   * Un abonnement qui devient courant clôt un abonnement **manuel** encore en
   * cours (un seul à la fois). S'il en existe un autre **en ligne**, rien n'est
   * écrit : `conflict` — clore localement un abonnement que Stripe continue de
   * facturer ferait payer deux abonnements, l'appelant arbitre chez Stripe.
   */
  async syncFromBilling(
    snapshot: BillingSubscriptionSnapshot,
    trx: TransactionClientContract
  ): Promise<SubscriptionSyncResult<OrganizationSubscription>> {
    const organizationId = await this.organizationOf(snapshot, trx)
    if (!organizationId) {
      logger.warn({ subscriptionId: snapshot.id }, 'billing subscription without organization')
      return { outcome: 'ignored' }
    }

    const existing = await OrganizationSubscription.query({ client: trx })
      .where('stripeSubscriptionId', snapshot.id)
      .forUpdate()
      .first()

    const plan = snapshot.plan ?? existing?.plan
    if (!plan) {
      logger.warn({ subscriptionId: snapshot.id }, 'billing subscription with an unknown price')
      return { outcome: 'ignored' }
    }

    const status = statusFromProvider(snapshot.providerStatus)
    const becomesCurrent = CURRENT_SUBSCRIPTION_STATUSES.includes(status)
    if (becomesCurrent) {
      const other = await this.otherCurrentOnline(organizationId, snapshot.id, trx)
      if (other) return { outcome: 'conflict', current: other }
    }

    const subscription = existing ?? new OrganizationSubscription()
    subscription.useTransaction(trx)
    subscription.merge({
      organizationId,
      plan,
      status,
      origin: 'stripe',
      stripeSubscriptionId: snapshot.id,
      stripeStatus: snapshot.providerStatus,
      startsAt: existing?.startsAt ?? DateTime.fromJSDate(snapshot.currentPeriodStart),
      endsAt: snapshot.currentPeriodEnd ? DateTime.fromJSDate(snapshot.currentPeriodEnd) : null,
      cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
      cancelledAt:
        status === 'cancelled' ? DateTime.fromJSDate(snapshot.canceledAt ?? new Date()) : null,
    })

    if (becomesCurrent) await this.closeCurrentManual(organizationId, trx)
    await subscription.save()
    await this.refreshPlan(organizationId, trx)
    return { outcome: 'synced', subscription }
  }

  /**
   * Recalcule la formule courante dénormalisée depuis l'abonnement en cours :
   * sa formule, ou `free` sans abonnement en cours.
   */
  async refreshPlan(organizationId: number, trx: TransactionClientContract): Promise<void> {
    await this.plans.refreshPlans([organizationId], trx)
  }

  /**
   * Organisation d'un abonnement : métadonnée posée à la souscription, à défaut
   * le profil de facturation qui porte ce client.
   */
  private async organizationOf(
    snapshot: BillingSubscriptionSnapshot,
    trx: TransactionClientContract
  ): Promise<number | null> {
    if (snapshot.organizationId) {
      const organization = await Organization.find(snapshot.organizationId, { client: trx })
      if (organization) return organization.id
    }
    const profile = await BillingProfile.query({ client: trx })
      .where('stripeCustomerId', snapshot.customerId)
      .first()
    return profile?.organizationId ?? null
  }

  /**
   * Autre abonnement **en ligne** en cours pour l'organisation (verrouillé
   * jusqu'à la fin de la transaction), s'il existe.
   */
  private async otherCurrentOnline(
    organizationId: number,
    stripeSubscriptionId: string,
    trx: TransactionClientContract
  ): Promise<(OrganizationSubscription & { stripeSubscriptionId: string }) | null> {
    const other = await OrganizationSubscription.query({ client: trx })
      .where('organizationId', organizationId)
      .whereIn('status', [...CURRENT_SUBSCRIPTION_STATUSES])
      .whereNotNull('stripeSubscriptionId')
      .whereNot('stripeSubscriptionId', stripeSubscriptionId)
      .forUpdate()
      .first()
    return other?.stripeSubscriptionId
      ? (other as OrganizationSubscription & { stripeSubscriptionId: string })
      : null
  }

  /**
   * Un abonnement en ligne qui devient courant remplace un abonnement **manuel**
   * encore en cours : un seul à la fois. Rien n'est facturé pour un abonnement
   * manuel, le clore ne laisse aucun paiement orphelin.
   */
  private async closeCurrentManual(
    organizationId: number,
    trx: TransactionClientContract
  ): Promise<void> {
    const closed = await OrganizationSubscription.query({ client: trx })
      .where('organizationId', organizationId)
      .whereIn('status', [...CURRENT_SUBSCRIPTION_STATUSES])
      .whereNull('stripeSubscriptionId')
      .update({
        status: 'cancelled',
        cancelledAt: DateTime.now().toSQL(),
        updatedAt: DateTime.now().toSQL(),
      })
    if (Number(closed) > 0) {
      logger.info({ organizationId }, 'manual subscription replaced by an online one')
    }
  }
}
