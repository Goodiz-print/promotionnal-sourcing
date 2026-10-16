import logger from '@adonisjs/core/services/logger'
import TranslateEntityJob from '#jobs/translate_entity_job'
import { CONTENT_LOCALES, DEFAULT_CONTENT_LOCALE } from '#shared/types/i18n'
import type { TranslatableEntity } from '#shared/types/ai'

/**
 * Planifie la traduction automatique d'une entité vers toutes les autres langues
 * de contenu (#75). À appeler **après** la sauvegarde (hors transaction ou après
 * son commit) : le job relit la ligne source en base.
 *
 * Résilient : un échec de queue ne doit jamais faire échouer la sauvegarde. Le
 * job est un no-op tant que `AI_TRANSLATION_ENABLED` est faux.
 */
export default class TranslationDispatcher {
  async dispatch(
    entity: TranslatableEntity,
    entityId: number,
    sourceLocale: string = DEFAULT_CONTENT_LOCALE
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
