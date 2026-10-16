import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import TranslateEntityJob from '#jobs/translate_entity_job'
import { CONTENT_LOCALES, type ContentLocale } from '#shared/types/i18n'
import type { TranslatableEntity } from '#shared/types/ai'

/**
 * Planifie la traduction automatique d'une entité vers les autres langues de
 * contenu. Résilient : un échec de queue ne doit jamais faire échouer la
 * sauvegarde (le job est un no-op tant que l'IA est désactivée, et rejouable).
 * Les lignes saisies à la main (`is_auto = false`) sont protégées par
 * `TranslationService`, pas ici.
 */
@inject()
export default class TranslationQueueService {
  async queue(
    entity: TranslatableEntity,
    entityId: number,
    sourceLocale: ContentLocale
  ): Promise<void> {
    const targetLocales = CONTENT_LOCALES.filter((locale) => locale !== sourceLocale)
    if (targetLocales.length === 0) return
    try {
      await TranslateEntityJob.dispatch({ entity, entityId, sourceLocale, targetLocales })
    } catch (error) {
      logger.warn({ err: error, entity, entityId }, 'failed to queue entity translation')
    }
  }
}
