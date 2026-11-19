import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import BillingProfile from '#models/billing_profile'
import Organization from '#models/organization'
import OrganizationSubscription from '#models/organization_subscription'
import { statusFromProvider } from '#shared/helpers/subscription'
import type { SubscriptionPlan } from '#shared/types/organization'
import {
  CURRENT_SUBSCRIPTION_STATUSES,
  type BillingSubscriptionSnapshot,
} from '#shared/types/subscription'

/**
 * Abonnements des organisations (cf. `docs/abonnements.md`). **Seul** point du
 * code qui écrit `organizations.subscription_plan` (formule courante
 * dénormalisée), et seul point qui répond à « abonné ou non ».
 */
export default class SubscriptionService {
  /** Abonnement en cours (`active` ou `past_due`) de l'organisation, s'il existe. */
  current(
    organizationId: number,
    client?: TransactionClientContract
  ): Promise<OrganizationSubscription | null> {
    return OrganizationSubscription.query({ client })
      .where('organizationId', organizationId)
      .whereIn('status', [...CURRENT_SUBSCRIPTION_STATUSES])
      .first()
  }

  /** L'organisation a-t-elle un abonnement payant en cours, à l'instant de la lecture ? */
  async isSubscribed(organizationId: number): Promise<boolean> {
    return (await this.current(organizationId)) !== null
  }

  /**
   * Aligne l'abonnement local sur l'état relu chez le prestataire, puis la
   * formule courante de l'organisation. **Idempotent** : la ligne est retrouvée
   * par `stripe_subscription_id`, un état rejoué ne change rien.
   */
  async syncFromBilling(
    snapshot: BillingSubscriptionSnapshot,
    trx: TransactionClientContract
  ): Promise<OrganizationSubscription | null> {
    const organizationId = await this.organizationOf(snapshot, trx)
    if (!organizationId) {
      logger.warn({ subscriptionId: snapshot.id }, 'billing subscription without organization')
      return null
    }

    const existing = await OrganizationSubscription.query({ client: trx })
      .where('stripeSubscriptionId', snapshot.id)
      .forUpdate()
      .first()

    const plan = snapshot.plan ?? existing?.plan
    if (!plan) {
      logger.warn({ subscriptionId: snapshot.id }, 'billing subscription with an unknown price')
      return null
    }

    const status = statusFromProvider(snapshot.providerStatus)
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

    if (CURRENT_SUBSCRIPTION_STATUSES.includes(status)) {
      await this.closeOtherCurrent(organizationId, snapshot.id, trx)
    }
    await subscription.save()
    await this.refreshPlan(organizationId, trx)
    return subscription
  }

  /**
   * Recalcule la formule courante dénormalisée depuis l'abonnement en cours :
   * sa formule, ou `free` sans abonnement en cours.
   */
  async refreshPlan(organizationId: number, trx: TransactionClientContract): Promise<void> {
    const current = await this.current(organizationId, trx)
    const plan: SubscriptionPlan = current?.plan ?? 'free'
    await Organization.query({ client: trx })
      .where('id', organizationId)
      .update({ subscriptionPlan: plan })
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
   * Un abonnement en ligne qui devient courant remplace tout autre abonnement
   * en cours (saisi à la main, par exemple) : un seul à la fois.
   */
  private async closeOtherCurrent(
    organizationId: number,
    stripeSubscriptionId: string,
    trx: TransactionClientContract
  ): Promise<void> {
    const closed = await OrganizationSubscription.query({ client: trx })
      .where('organizationId', organizationId)
      .whereIn('status', [...CURRENT_SUBSCRIPTION_STATUSES])
      .where((query) =>
        query
          .whereNull('stripeSubscriptionId')
          .orWhereNot('stripeSubscriptionId', stripeSubscriptionId)
      )
      .update({
        status: 'cancelled',
        cancelledAt: DateTime.now().toSQL(),
        updatedAt: DateTime.now().toSQL(),
      })
    if (Number(closed) > 0) {
      logger.info({ organizationId }, 'previous current subscription replaced by an online one')
    }
  }
}
