import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import app from '@adonisjs/core/services/app'
import type { TranslatableEntity } from '#shared/types/ai'

interface TranslationBackfillPayload {
  /** Types à rattraper ; tous si absent. */
  entities?: TranslatableEntity[]
  /** Produits d'une seule fiche fournisseur (rattachement, #240). */
  supplierId?: number
}

/**
 * Rattrapage des traductions lancé depuis le back-office (#177), ou au
 * rattachement d'une fiche fournisseur pour ses seuls produits (#240) : met en file un
 * `TranslateEntityJob` par entité à traduire, comme `node ace translation:backfill`.
 * Idempotent (clé de traduction) : pas de nouvel essai automatique, l'admin relance.
 *
 * `TranslationBackfillService` importe le modèle `Product` : un job est chargé au
 * boot de la queue, avant le service `hash` (voir la règle DI de `CLAUDE.md`). Le
 * service est donc importé et résolu dans `execute()` uniquement.
 */
export default class TranslationBackfillJob extends Job<TranslationBackfillPayload> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 0,
  }

  async execute() {
    const { default: TranslationBackfillService } =
      await import('#services/translation_backfill_service')
    const backfill = await app.container.make(TranslationBackfillService)

    const { entities, supplierId } = this.payload
    // `supplierId` absent (rattrapage global) : l'option n'est pas transmise du tout.
    const scope = supplierId === undefined ? {} : { supplierId }
    const report = await backfill.backfill({ entities, ...scope })
    logger.info(
      { queued: report.queued, failed: report.failed, supplierId },
      'translation backfill'
    )
  }

  async failed(error: Error) {
    logger.error({ err: error }, 'translation backfill failed')
  }
}
