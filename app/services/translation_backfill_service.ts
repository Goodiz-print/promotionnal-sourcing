import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import TranslationQueueService from '#services/translation_queue_service'
import {
  TRANSLATABLE_ENTITIES,
  type TranslatableEntity,
  type TranslationBackfillOptions,
  type TranslationBackfillReport,
} from '#shared/types/ai'
import type { TranslationLocale } from '#shared/types/i18n'

const BATCH_SIZE = 500

/** Tables des entités traduisibles ; seuls les produits actifs sont rattrapés. */
const ENTITY_SOURCES: Record<TranslatableEntity, { table: string; activeOnly: boolean }> = {
  product: { table: 'products', activeOnly: true },
  category: { table: 'categories', activeOnly: false },
  attribute: { table: 'attributes', activeOnly: false },
  attribute_value: { table: 'attribute_values', activeOnly: false },
}

/**
 * Rattrape les traductions des contenus existants (#97) : met en file, pour
 * chaque entité, la traduction vers les langues de contenu manquantes.
 *
 * Idempotent : `TranslationService` n'appelle l'IA que pour les langues sans
 * traduction à jour (clé d'idempotence) et ne touche jamais une ligne saisie à
 * la main. Relancer la commande ne coûte donc rien pour ce qui est déjà traduit.
 */
@inject()
export default class TranslationBackfillService {
  constructor(private queue: TranslationQueueService) {}

  async backfill(options: TranslationBackfillOptions = {}): Promise<TranslationBackfillReport> {
    const report: TranslationBackfillReport = {
      product: 0,
      category: 0,
      attribute: 0,
      attribute_value: 0,
    }
    const entities = options.entities ?? TRANSLATABLE_ENTITIES

    for (const entity of TRANSLATABLE_ENTITIES.filter((e) => entities.includes(e))) {
      report[entity] = await this.backfillEntity(entity, options.limit)
    }
    return report
  }

  /** Parcourt la table par lots d'identifiants croissants, jusqu'à `limit` entités. */
  private async backfillEntity(entity: TranslatableEntity, limit?: number): Promise<number> {
    const { table, activeOnly } = ENTITY_SOURCES[entity]
    let queued = 0
    let lastId = 0

    while (limit === undefined || queued < limit) {
      const query = db
        .from(table)
        .select('id', 'source_locale')
        .where('id', '>', lastId)
        .orderBy('id')
        .limit(limit === undefined ? BATCH_SIZE : Math.min(BATCH_SIZE, limit - queued))
      if (activeOnly) query.where('is_active', true)

      const rows: { id: number; source_locale: string }[] = await query
      if (rows.length === 0) break

      for (const row of rows) {
        await this.queue.queue(entity, row.id, row.source_locale as TranslationLocale)
      }
      queued += rows.length
      lastId = rows[rows.length - 1].id
    }
    return queued
  }
}
