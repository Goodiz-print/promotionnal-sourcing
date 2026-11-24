import db from '@adonisjs/lucid/services/db'
import { dateRangeBounds, nameTargets, toTargetTranslation } from '#shared/helpers/activity_event'
import type { ActivityDateRange, ActivityTargetCount } from '#shared/types/activity_event'

type Query = ReturnType<typeof db.from>

/** Table de traductions qui nomme une cible, et sa clé vers la cible. */
const TRANSLATION_TABLES = {
  product: { table: 'product_translations', foreignKey: 'product_id' },
  supplier: { table: 'supplier_translations', foreignKey: 'supplier_id' },
} as const

/**
 * Briques de lecture de `activity_events` (#172), communes au back-office
 * (« Ce que cherchent les clients », #173) et à l'espace fournisseur
 * (« Consultations », #239) : événements d'une période, comptage par cible,
 * nom des cibles. Lecture seule, accès `db` (aucun modèle).
 */
export default class ActivityAggregationService {
  /** Événements de la période (alias `ae`), à compléter par l'appelant. */
  events(range: ActivityDateRange): Query {
    const { start, end } = dateRangeBounds(range)
    return db
      .from('activity_events as ae')
      .where('ae.created_at', '>=', start)
      .where('ae.created_at', '<', end)
  }

  /** Les `limit` cibles d'un type les plus fréquentes de `query`, avec leur nombre d'événements. */
  async countByTarget(
    query: Query,
    targetType: keyof typeof TRANSLATION_TABLES,
    limit: number
  ): Promise<ActivityTargetCount[]> {
    const rows = await query
      .where('ae.target_type', targetType)
      .select('ae.target_id', db.raw('count(*)::int as total'))
      .groupBy('ae.target_id')
      .orderBy('total', 'desc')
      .orderBy('ae.target_id', 'asc')
      .limit(limit)
    return rows.map((row) => ({ targetId: Number(row.target_id), count: Number(row.total) }))
  }

  /** Ajoute le nom de chaque cible, dans la langue de l'écran (repli `resolveTranslation`). */
  async named<T extends Pick<ActivityTargetCount, 'targetId'>>(
    rows: T[],
    targetType: keyof typeof TRANSLATION_TABLES,
    locale: string
  ): Promise<(T & { name: string })[]> {
    if (rows.length === 0) return []
    const { table, foreignKey } = TRANSLATION_TABLES[targetType]
    const translations = await db
      .from(table)
      .whereIn(
        foreignKey,
        rows.map((row) => row.targetId)
      )
      .select(`${foreignKey} as target_id`, 'locale', 'name')

    return nameTargets(rows, translations.map(toTargetTranslation), locale)
  }
}
