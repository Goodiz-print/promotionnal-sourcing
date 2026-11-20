import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
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
  isValidSubscriptionPeriod,
  subscriptionDayEnd,
  subscriptionDayStart,
} from '#shared/helpers/subscription_period'
import {
  BLOCKING_SUBSCRIPTION_STATUSES,
  type ManualSubscriptionInput,
  type SubscriptionStatus,
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
 * `manual`) : création datée, prolongation, résiliation. L'activation et
 * l'expiration automatiques sont dans `SubscriptionScheduleService`. La formule
 * courante de l'organisation est recalculée par `SubscriptionService#refreshPlan`.
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

    const startsAt = subscriptionDayStart(input.startsOn)
    const endsAt = subscriptionDayEnd(input.endsOn)
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
    const endsAt = subscriptionDayEnd(endsOn)
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

function assertPeriod(startsAt: DateTime, endsAt: DateTime): void {
  if (!isValidSubscriptionPeriod(startsAt, endsAt)) throw new InvalidSubscriptionPeriodException()
}
