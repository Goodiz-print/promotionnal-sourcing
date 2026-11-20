import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { QueryClientContract, TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ChainableContract } from '@adonisjs/lucid/types/querybuilder'
import type { SubscriptionPlan } from '#shared/types/organization'
import { CURRENT_SUBSCRIPTION_STATUSES } from '#shared/types/subscription'

/**
 * Règle « abonnement en cours », seule définition du code (#214) : statut
 * `active` ou `past_due` et, pour un abonnement **manuel**, date de fin non
 * dépassée — un abonnement échu ne compte plus, même avant le passage du job qui
 * l'expire. La date de fin d'un abonnement en ligne (fin de période facturée)
 * n'est pas lue : Stripe reste juge pendant les relances d'impayé.
 *
 * S'applique à une requête sur `organization_subscriptions`, Lucid ou `db`
 * (noms de colonnes en snake_case).
 */
export function whereCurrentSubscription<Query extends ChainableContract>(
  query: Query,
  now: DateTime = DateTime.now()
): Query {
  return query
    .whereIn('status', [...CURRENT_SUBSCRIPTION_STATUSES])
    .where((current) =>
      current
        .whereNotNull('stripe_subscription_id')
        .orWhereNull('ends_at')
        .orWhere('ends_at', '>', now.toSQL()!)
    )
}

/**
 * Formule courante des organisations : lecture de la règle « abonné » en masse
 * et écriture de `organizations.subscription_plan`, **seul** point qui l'écrit
 * (`SubscriptionService#refreshPlan` passe par ici).
 *
 * Accès par `db`, sans modèle Lucid : utilisable depuis un job (la queue charge
 * les jobs au boot, avant que les modèles puissent être évalués, cf. `CLAUDE.md`).
 */
export default class SubscriptionPlanService {
  /** Organisations parmi `organizationIds` qui ont un abonnement en cours. */
  async subscribedAmong(
    organizationIds: number[],
    client?: QueryClientContract
  ): Promise<Set<number>> {
    if (organizationIds.length === 0) return new Set()
    const rows: Array<{ organization_id: number }> = await whereCurrentSubscription(
      (client ?? db).from('organization_subscriptions').whereIn('organization_id', organizationIds)
    ).select('organization_id')
    return new Set(rows.map((row) => row.organization_id))
  }

  /**
   * Recalcule la formule courante de chaque organisation : celle de son
   * abonnement en cours, `free` sans abonnement en cours. Une lecture, une écriture.
   */
  async refreshPlans(organizationIds: number[], trx: TransactionClientContract): Promise<void> {
    if (organizationIds.length === 0) return
    const current: Array<{ organization_id: number; plan: SubscriptionPlan }> =
      await whereCurrentSubscription(
        trx.from('organization_subscriptions').whereIn('organization_id', organizationIds)
      ).select('organization_id', 'plan')
    const planOf = new Map(current.map((row) => [row.organization_id, row.plan]))
    const cases = organizationIds.map(() => 'WHEN ? THEN ?').join(' ')
    const bindings = organizationIds.flatMap((id) => [id, planOf.get(id) ?? 'free'])
    await trx
      .from('organizations')
      .whereIn('id', organizationIds)
      .update({ subscription_plan: trx.raw(`CASE id ${cases} END`, bindings) })
  }
}
