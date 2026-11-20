import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Organization from '#models/organization'
import OrganizationSubscription from '#models/organization_subscription'
import SubscriptionService from '#services/subscription_service'
import {
  InvalidSubscriptionPeriodException,
  SubscriptionAlreadyOpenException,
  SubscriptionNotEditableException,
  SubscriptionNotSupplierException,
} from '#exceptions/subscription_errors'
import {
  BLOCKING_SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_TIMEZONE,
  type ManualSubscriptionInput,
  type SubscriptionStatus,
  type SubscriptionSyncDueResult,
} from '#shared/types/subscription'

/** Statuts d'un abonnement encore ouvert : il bloque la saisie d'un second. */
const OPEN_STATUSES: readonly SubscriptionStatus[] = [
  ...BLOCKING_SUBSCRIPTION_STATUSES,
  'scheduled',
]

/** Statuts d'un abonnement manuel que l'admin peut encore prolonger ou résilier. */
const EDITABLE_STATUSES: readonly SubscriptionStatus[] = ['scheduled', 'active']

/**
 * Abonnements saisis à la main par l'équipe plateforme (#214, origine
 * `manual`) : création datée, prolongation, résiliation, puis activation et
 * expiration automatiques. La formule courante de l'organisation est recalculée
 * par `SubscriptionService#refreshPlan`, seul point qui l'écrit.
 */
@inject()
export default class ManualSubscriptionService {
  constructor(private subscriptions: SubscriptionService) {}

  /**
   * Crée un abonnement manuel : actif tout de suite si son jour de début est
   * atteint, programmé sinon. Refusé si un autre abonnement est encore ouvert.
   */
  async create(
    input: ManualSubscriptionInput,
    trx: TransactionClientContract
  ): Promise<OrganizationSubscription> {
    const organization = await Organization.query({ client: trx })
      .where('id', input.organizationId)
      .forUpdate()
      .firstOrFail()
    if (organization.organizationType === 'buyer') throw new SubscriptionNotSupplierException()

    const startsAt = startOfDay(input.startsOn)
    const endsAt = endOfDay(input.endsOn)
    assertPeriod(startsAt, endsAt)
    if (await this.openFor(organization.id, trx)) throw new SubscriptionAlreadyOpenException()

    const subscription = await OrganizationSubscription.create(
      {
        organizationId: organization.id,
        plan: input.plan,
        status: startsAt <= DateTime.now() ? 'active' : 'scheduled',
        origin: 'manual',
        startsAt,
        endsAt,
        createdByUserId: input.authorId,
      },
      { client: trx }
    )
    await this.subscriptions.refreshPlan(organization.id, trx)
    return subscription
  }

  /** Change la date de fin (jour inclus) d'un abonnement manuel ouvert. */
  async extend(
    subscriptionId: number,
    endsOn: string,
    trx: TransactionClientContract
  ): Promise<OrganizationSubscription> {
    const subscription = await this.editable(subscriptionId, trx)
    const endsAt = endOfDay(endsOn)
    assertPeriod(subscription.startsAt, endsAt)

    subscription.endsAt = endsAt
    await subscription.save()
    return subscription
  }

  /** Résilie immédiatement un abonnement manuel ouvert : retour en `free`. */
  async cancel(
    subscriptionId: number,
    trx: TransactionClientContract
  ): Promise<OrganizationSubscription> {
    const subscription = await this.editable(subscriptionId, trx)
    subscription.merge({ status: 'cancelled', cancelledAt: DateTime.now() })
    await subscription.save()
    await this.subscriptions.refreshPlan(subscription.organizationId, trx)
    return subscription
  }

  /**
   * Passage planifié : expire les abonnements manuels échus, puis active ceux
   * dont le jour de début est atteint. L'ordre permet d'enchaîner un
   * renouvellement programmé sur la fin d'un abonnement. **Idempotent** : un
   * second passage ne trouve plus rien à faire.
   */
  async syncDue(now: DateTime = DateTime.now()): Promise<SubscriptionSyncDueResult> {
    return db.transaction(async (trx) => {
      const expired = await this.expireDue(now, trx)
      const activated = await this.activateDue(now, trx)
      const organizationIds = [...expired, ...activated].map((s) => s.organizationId)
      await this.subscriptions.refreshPlans([...new Set(organizationIds)], trx)
      return { expired: expired.map((s) => s.id), activated: activated.map((s) => s.id) }
    })
  }

  private async expireDue(
    now: DateTime,
    trx: TransactionClientContract
  ): Promise<OrganizationSubscription[]> {
    const due = await this.manualQuery(trx)
      .whereIn('status', ['active', 'scheduled'])
      .where('endsAt', '<=', now.toSQL()!)
      .forUpdate()
    await this.setStatus(due, 'expired', trx)
    return due
  }

  /**
   * Active les abonnements programmés arrivés à leur jour de début. Une
   * organisation qui a souscrit en ligne entre-temps garde cet abonnement-là :
   * le programmé reste en attente et l'admin arbitre.
   */
  private async activateDue(
    now: DateTime,
    trx: TransactionClientContract
  ): Promise<OrganizationSubscription[]> {
    const due = await this.manualQuery(trx)
      .where('status', 'scheduled')
      .where('startsAt', '<=', now.toSQL()!)
      .forUpdate()
    const alreadyCurrent = await this.subscriptions.subscribedAmong(
      due.map((subscription) => subscription.organizationId),
      trx
    )
    const [activated, leftPending] = partition(due, (s) => !alreadyCurrent.has(s.organizationId))
    if (leftPending.length > 0) {
      logger.warn(
        { subscriptionIds: leftPending.map((s) => s.id) },
        'scheduled subscription left pending'
      )
    }
    await this.setStatus(activated, 'active', trx)
    return activated
  }

  /** Change le statut de plusieurs abonnements en une requête. */
  private async setStatus(
    subscriptions: OrganizationSubscription[],
    status: SubscriptionStatus,
    trx: TransactionClientContract
  ): Promise<void> {
    if (subscriptions.length === 0) return
    await OrganizationSubscription.query({ client: trx })
      .whereIn(
        'id',
        subscriptions.map((subscription) => subscription.id)
      )
      .update({ status, updatedAt: DateTime.now().toSQL() })
    subscriptions.forEach((subscription) => (subscription.status = status))
  }

  private manualQuery(trx: TransactionClientContract) {
    return OrganizationSubscription.query({ client: trx }).whereNull('stripeSubscriptionId')
  }

  private openFor(
    organizationId: number,
    trx: TransactionClientContract
  ): Promise<OrganizationSubscription | null> {
    return OrganizationSubscription.query({ client: trx })
      .where('organizationId', organizationId)
      .whereIn('status', [...OPEN_STATUSES])
      .first()
  }

  /** Abonnement manuel encore ouvert, verrouillé ; lève sinon. */
  private async editable(
    subscriptionId: number,
    trx: TransactionClientContract
  ): Promise<OrganizationSubscription> {
    const subscription = await OrganizationSubscription.query({ client: trx })
      .where('id', subscriptionId)
      .forUpdate()
      .firstOrFail()
    const isManual = subscription.stripeSubscriptionId === null
    if (!isManual || !EDITABLE_STATUSES.includes(subscription.status)) {
      throw new SubscriptionNotEditableException()
    }
    return subscription
  }
}

/** Sépare les éléments qui satisfont `keep` des autres, en conservant l'ordre. */
function partition<T>(items: T[], keep: (item: T) => boolean): [T[], T[]] {
  return [items.filter(keep), items.filter((item) => !keep(item))]
}

function startOfDay(day: string): DateTime {
  return DateTime.fromISO(day, { zone: SUBSCRIPTION_TIMEZONE }).startOf('day')
}

/** Fin d'un jour inclus : le début du jour suivant. */
function endOfDay(day: string): DateTime {
  return startOfDay(day).plus({ days: 1 })
}

function assertPeriod(startsAt: DateTime, endsAt: DateTime): void {
  if (!startsAt.isValid || !endsAt.isValid) throw new InvalidSubscriptionPeriodException()
  if (endsAt <= startsAt || endsAt <= DateTime.now()) {
    throw new InvalidSubscriptionPeriodException()
  }
}
