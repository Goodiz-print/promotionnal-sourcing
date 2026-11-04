import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import Product from '#models/product'
import TranslationQueueService from '#services/translation_queue_service'
import {
  TRANSLATABLE_ENTITIES,
  type TranslatableEntity,
  type TranslationBackfillOptions,
  type TranslationBackfillReport,
} from '#shared/types/ai'
import type { TranslationLocale } from '#shared/types/i18n'

const BATCH_SIZE = 500

interface SourceRow {
  id: number
  sourceLocale: string
}

/** Tables des entités traduisibles autres que les produits (aucune règle de visibilité). */
const TABLES: Record<Exclude<TranslatableEntity, 'product'>, string> = {
  category: 'categories',
  attribute: 'attributes',
  attribute_value: 'attribute_values',
  certification: 'certifications',
  marking_technique: 'marking_techniques',
}

/**
 * Rattrape les traductions des contenus existants (#97) : met en file, pour
 * chaque entité, la traduction vers les langues de contenu manquantes.
 *
 * Idempotent : `TranslationService` n'appelle l'IA que pour les langues sans
 * traduction à jour (clé d'idempotence) et ne touche jamais une ligne saisie à
 * la main. Relancer la commande ne coûte donc rien pour ce qui est déjà traduit.
 *
 * Seuls les produits **visibles** sont traités (actifs, organisation non
 * archivée ni rejetée, non rejetés par la modération) : pas de tokens dépensés
 * sur du contenu jamais affiché. Le rattrapage s'arrête au premier job que la file
 * refuse (file indisponible) : rien n'est compté à tort.
 */
@inject()
export default class TranslationBackfillService {
  constructor(private queue: TranslationQueueService) {}

  async backfill(options: TranslationBackfillOptions = {}): Promise<TranslationBackfillReport> {
    const report: TranslationBackfillReport = {
      queued: {
        product: 0,
        category: 0,
        attribute: 0,
        attribute_value: 0,
        certification: 0,
        marking_technique: 0,
      },
      failed: false,
    }
    const entities = options.entities ?? TRANSLATABLE_ENTITIES

    for (const entity of TRANSLATABLE_ENTITIES.filter((e) => entities.includes(e))) {
      const { queued, failed } = await this.backfillEntity(entity, options.limit)
      report.queued[entity] = queued
      if (failed) {
        report.failed = true
        break
      }
    }
    return report
  }

  /** Parcourt les entités par lots d'identifiants croissants, jusqu'à `limit` mises en file. */
  private async backfillEntity(
    entity: TranslatableEntity,
    limit?: number
  ): Promise<{ queued: number; failed: boolean }> {
    let queued = 0
    let lastId = 0

    while (limit === undefined || queued < limit) {
      const size = limit === undefined ? BATCH_SIZE : Math.min(BATCH_SIZE, limit - queued)
      const rows = await this.nextBatch(entity, lastId, size)
      if (rows.length === 0) break

      for (const row of rows) {
        const dispatched = await this.queue.queue(
          entity,
          row.id,
          row.sourceLocale as TranslationLocale
        )
        if (!dispatched) return { queued, failed: true }
        queued++
      }
      lastId = rows[rows.length - 1].id
    }
    return { queued, failed: false }
  }

  private async nextBatch(
    entity: TranslatableEntity,
    afterId: number,
    size: number
  ): Promise<SourceRow[]> {
    if (entity === 'product') {
      const products = await Product.query()
        .select('id', 'sourceLocale')
        .where('isActive', true)
        .withScopes((scopes) => {
          scopes.fromLiveOrganization()
          scopes.notRejected()
        })
        .where('id', '>', afterId)
        .orderBy('id')
        .limit(size)
      return products.map((product) => ({ id: product.id, sourceLocale: product.sourceLocale }))
    }

    const rows: { id: number; source_locale: string }[] = await db
      .from(TABLES[entity])
      .select('id', 'source_locale')
      .where('id', '>', afterId)
      .orderBy('id')
      .limit(size)
    return rows.map((row) => ({ id: row.id, sourceLocale: row.source_locale }))
  }
}
