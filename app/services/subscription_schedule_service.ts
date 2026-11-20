import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import SubscriptionPlanService from '#services/subscription_plan_service'
import { partition } from '#shared/helpers/collections'
import type { SubscriptionStatus, SubscriptionSyncDueResult } from '#shared/types/subscription'

/** Abonnement manuel arrivé à échéance de début ou de fin. */
interface DueSubscription {
  id: number
  organization_id: number
}

/**
 * Passage planifié sur les abonnements manuels (#214, `SyncSubscriptionsJob`) :
 * expiration des échus, activation des programmés, puis formule courante.
 *
 * Accès par `db`, sans modèle Lucid : le job l'injecte par son constructeur,
 * or la queue charge les jobs au boot, avant que les modèles puissent être
 * évalués (cf. `CLAUDE.md`).
 */
@inject()
export default class SubscriptionScheduleService {
  constructor(private plans: SubscriptionPlanService) {}

  /**
   * Expire les abonnements manuels échus, puis active ceux dont le jour de
   * début est atteint : un renouvellement programmé prend ainsi le relais de
   * l'abonnement qui se termine. **Idempotent** : un second passage ne trouve
   * plus rien à faire. Les abonnements en ligne ne sont jamais touchés.
   */
  async syncDue(now: DateTime = DateTime.now()): Promise<SubscriptionSyncDueResult> {
    return db.transaction(async (trx) => {
      const expired = await this.expireDue(now, trx)
      const activated = await this.activateDue(now, trx)
      const organizationIds = [...expired, ...activated].map((row) => row.organization_id)
      await this.plans.refreshPlans([...new Set(organizationIds)], trx)
      return { expired: expired.map((row) => row.id), activated: activated.map((row) => row.id) }
    })
  }

  private async expireDue(
    now: DateTime,
    trx: TransactionClientContract
  ): Promise<DueSubscription[]> {
    const due: DueSubscription[] = await this.manual(trx)
      .whereIn('status', ['active', 'scheduled'])
      .where('ends_at', '<=', now.toSQL()!)
      .forUpdate()
      .select('id', 'organization_id')
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
  ): Promise<DueSubscription[]> {
    const due: DueSubscription[] = await this.manual(trx)
      .where('status', 'scheduled')
      .where('starts_at', '<=', now.toSQL()!)
      .forUpdate()
      .select('id', 'organization_id')
    const alreadyCurrent = await this.plans.subscribedAmong(
      due.map((row) => row.organization_id),
      trx
    )
    const [activated, leftPending] = partition(
      due,
      (row) => !alreadyCurrent.has(row.organization_id)
    )
    if (leftPending.length > 0) {
      logger.warn(
        { subscriptionIds: leftPending.map((row) => row.id) },
        'scheduled subscription left pending'
      )
    }
    await this.setStatus(activated, 'active', trx)
    return activated
  }

  /** Change le statut de plusieurs abonnements en une requête. */
  private async setStatus(
    rows: DueSubscription[],
    status: SubscriptionStatus,
    trx: TransactionClientContract
  ): Promise<void> {
    if (rows.length === 0) return
    await trx
      .from('organization_subscriptions')
      .whereIn(
        'id',
        rows.map((row) => row.id)
      )
      .update({ status, updated_at: DateTime.now().toSQL() })
  }

  private manual(trx: TransactionClientContract) {
    return trx.from('organization_subscriptions').whereNull('stripe_subscription_id')
  }
}
