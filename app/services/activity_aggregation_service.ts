import db from '@adonisjs/lucid/services/db'
import { dateRangeBounds, nameTargets, toTargetTranslation } from '#shared/helpers/activity_event'
import type { ActivityDateRange, ActivityTargetCount } from '#shared/types/activity_event'
import type { DbQuery } from '#shared/types/database'

/**
 * Table de traductions qui nomme une cible, sa clé vers la cible, et la table
 * qui porte la langue source de la cible (premier repli, comme au catalogue) ;
 * `null` quand la cible n'en a pas (fiche fournisseur).
 */
const TRANSLATION_TABLES = {
  product: { table: 'product_translations', foreignKey: 'product_id', source: 'products' },
  supplier: { table: 'supplier_translations', foreignKey: 'supplier_id', source: null },
} as const

/**
 * Briques de lecture de `activity_events` (#172), communes au back-office
 * (« Ce que cherchent les clients », #173) et à l'espace fournisseur
 * (« Consultations », #239) : événements d'une période, comptage par cible,
 * nom des cibles. Lecture seule, accès `db` (aucun modèle).
 */
export default class ActivityAggregationService {
  /** Événements de la période (alias `ae`), à compléter par l'appelant. */
  events(range: ActivityDateRange): DbQuery {
    const { start, end } = dateRangeBounds(range)
    return db
      .from('activity_events as ae')
      .where('ae.created_at', '>=', start)
      .where('ae.created_at', '<', end)
  }

  /** Les `limit` cibles d'un type les plus fréquentes de `query`, avec leur nombre d'événements. */
  async countByTarget(
    query: DbQuery,
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
    const translations = await this.translations(
      targetType,
      rows.map((row) => row.targetId)
    )
    return nameTargets(rows, translations.map(toTargetTranslation), locale)
  }

  /** Traductions des cibles, avec la langue source de chacune quand elle en a une. */
  private translations(targetType: keyof typeof TRANSLATION_TABLES, targetIds: number[]) {
    const { table, foreignKey, source } = TRANSLATION_TABLES[targetType]
    const query = db
      .from(`${table} as t`)
      .whereIn(`t.${foreignKey}`, targetIds)
      .select(`t.${foreignKey} as target_id`, 't.locale', 't.name')
    if (!source) return query.select(db.raw('null as source_locale'))
    return query.join(`${source} as s`, 's.id', `t.${foreignKey}`).select('s.source_locale')
  }
}
