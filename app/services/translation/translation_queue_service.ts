import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import TranslateEntityJob from '#jobs/translate_entity_job'
import { TRANSLATION_LOCALES, type TranslationLocale } from '#shared/types/i18n'
import type { TranslatableEntity } from '#shared/types/ai'

/**
 * Planifie la traduction automatique d'une entité à la sauvegarde (#75) : une
 * seule tâche par entité, qui vise toutes les langues de `TRANSLATION_LOCALES`
 * sauf la langue source (`source_locale` de l'entité). Résilient : un échec de
 * queue ne fait jamais échouer la sauvegarde ; le job est rejouable (idempotence
 * côté `TranslationService`).
 */
@inject()
export default class TranslationQueueService {
  async queue(
    entity: TranslatableEntity,
    entityId: number,
    sourceLocale: TranslationLocale
  ): Promise<void> {
    try {
      await TranslateEntityJob.dispatch({
        entity,
        entityId,
        sourceLocale,
        targetLocales: TRANSLATION_LOCALES.filter((locale) => locale !== sourceLocale),
      })
    } catch (error) {
      logger.warn({ err: error, entity, entityId }, 'failed to queue translation')
    }
  }
}
