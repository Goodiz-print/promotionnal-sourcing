import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import Product from '#models/product'
import TranslationQueueService from '#services/translation_queue_service'
import {
  emptyBackfillCounts,
  nextBackfillBatchSize,
  selectBackfillEntities,
} from '#shared/helpers/translation_backfill'
import type {
  TranslatableEntity,
  TranslationBackfillBatch,
  TranslationBackfillEntityResult,
  TranslationBackfillOptions,
  TranslationBackfillProgress,
  TranslationBackfillReport,
  TranslationBackfillRow,
} from '#shared/types/ai'
import type { TranslationLocale } from '#shared/types/i18n'

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
 * Seuls les produits **visibles** sont traités (actifs, fiche rattachée à une
 * organisation ni archivée ni rejetée, non rejetés par la modération) : pas de
 * tokens dépensés sur du contenu jamais affiché. Une fiche qui vient d'être
 * rattachée est donc rattrapée à ce moment-là (`supplierId`, #240).
 *
 * Les mises en file sont **séquentielles** : le rattrapage s'arrête au premier
 * job que la file refuse (file indisponible), sans le compter ni aller plus
 * loin. D'où des parcours récursifs (types, lots, lignes) plutôt que des
 * `Promise.all`.
 */
@inject()
export default class TranslationBackfillService {
  /** Taille d'un lot lu en base ; modifiable par les tests pour traverser plusieurs lots. */
  static batchSize = 500

  constructor(private queue: TranslationQueueService) {}

  async backfill(options: TranslationBackfillOptions = {}): Promise<TranslationBackfillReport> {
    const entities = selectBackfillEntities(options.entities)
    const report: TranslationBackfillReport = { queued: emptyBackfillCounts(), failed: false }
    return this.backfillEntities(entities, options, report)
  }

  /** Rattrape les types un par un ; un refus de la file arrête tout. */
  private async backfillEntities(
    entities: TranslatableEntity[],
    options: TranslationBackfillOptions,
    report: TranslationBackfillReport
  ): Promise<TranslationBackfillReport> {
    const [entity, ...rest] = entities
    if (!entity) return report

    const { queued, failed } = await this.backfillEntity(entity, options, {
      queued: 0,
      afterId: 0,
    })
    const next = { queued: { ...report.queued, [entity]: queued }, failed }
    return failed ? next : this.backfillEntities(rest, options, next)
  }

  /** Parcourt un type par lots d'identifiants croissants, jusqu'à `limit` mises en file. */
  private async backfillEntity(
    entity: TranslatableEntity,
    { limit, supplierId }: TranslationBackfillOptions,
    { queued, afterId }: TranslationBackfillProgress
  ): Promise<TranslationBackfillEntityResult> {
    const size = nextBackfillBatchSize(TranslationBackfillService.batchSize, queued, limit)
    if (size === 0) return { queued, failed: false }
    const rows = await this.nextBatch(entity, { afterId, size, supplierId })
    if (rows.length === 0) return { queued, failed: false }

    const dispatched = await this.queueRows(entity, rows, 0)
    const total = queued + dispatched
    if (dispatched < rows.length) return { queued: total, failed: true }
    return this.backfillEntity(
      entity,
      { limit, supplierId },
      { queued: total, afterId: rows[rows.length - 1].id }
    )
  }

  /** Met en file les lignes à partir de `index` ; renvoie le nombre de mises en file réussies. */
  private async queueRows(
    entity: TranslatableEntity,
    rows: TranslationBackfillRow[],
    index: number
  ): Promise<number> {
    const row = rows[index]
    if (!row) return 0
    const sourceLocale = row.sourceLocale as TranslationLocale
    const dispatched = await this.queue.queue(entity, row.id, sourceLocale)
    if (!dispatched) return 0
    return 1 + (await this.queueRows(entity, rows, index + 1))
  }

  private async nextBatch(
    entity: TranslatableEntity,
    { afterId, size, supplierId }: TranslationBackfillBatch
  ): Promise<TranslationBackfillRow[]> {
    if (entity === 'product') return this.nextProducts({ afterId, size, supplierId })

    const rows: { id: number; source_locale: string }[] = await db
      .from(TABLES[entity])
      .select('id', 'source_locale')
      .where('id', '>', afterId)
      .orderBy('id')
      .limit(size)
    return rows.map((row) => ({ id: row.id, sourceLocale: row.source_locale }))
  }

  /** Produits visibles, éventuellement restreints à une fiche fournisseur. */
  private async nextProducts({
    afterId,
    size,
    supplierId,
  }: TranslationBackfillBatch): Promise<TranslationBackfillRow[]> {
    const products = await Product.query()
      .select('id', 'sourceLocale')
      .where('isActive', true)
      .withScopes((scopes) => {
        scopes.fromLiveOrganization()
        scopes.notRejected()
      })
      .if(supplierId !== undefined, (query) => query.where('supplierId', supplierId!))
      .where('id', '>', afterId)
      .orderBy('id')
      .limit(size)
    return products.map((product) => ({ id: product.id, sourceLocale: product.sourceLocale }))
  }
}
