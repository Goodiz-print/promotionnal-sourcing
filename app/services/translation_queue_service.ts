import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import TranslateEntityJob from '#jobs/translate_entity_job'
import TranslationBackfillJob from '#jobs/translation_backfill_job'
import { TRANSLATION_LOCALES, type TranslationLocale } from '#shared/types/i18n'
import type { TranslatableEntity } from '#shared/types/ai'

/**
 * Planifie la traduction automatique d'une entité vers les autres langues de
 * contenu. Résilient : un échec de queue ne doit jamais faire échouer la
 * sauvegarde (le job est un no-op tant que l'IA est désactivée, et rejouable).
 * Les lignes saisies à la main (`is_auto = false`) sont protégées par
 * `TranslationService`, pas ici.
 *
 * `queue()` renvoie `true` si le job a été mis en file, `false` sinon (aucune
 * langue cible, ou échec de la file) : le rattrapage s'en sert pour ne compter que
 * les mises en file réelles.
 */
@inject()
export default class TranslationQueueService {
  async queue(
    entity: TranslatableEntity,
    entityId: number,
    sourceLocale: TranslationLocale
  ): Promise<boolean> {
    const targetLocales = TRANSLATION_LOCALES.filter((locale) => locale !== sourceLocale)
    if (targetLocales.length === 0) return false
    try {
      await TranslateEntityJob.dispatch({ entity, entityId, sourceLocale, targetLocales })
      return true
    } catch (error) {
      logger.warn({ err: error, entity, entityId }, 'failed to queue entity translation')
      return false
    }
  }

  /**
   * Met en file la traduction des produits d'une fiche fournisseur qui vient
   * d'être rattachée, donc publiée (#240). Un seul job, qui parcourt la fiche par
   * lots : la requête HTTP ne dépend pas de la taille du catalogue. Même
   * résilience que `queue()` : un échec est loggué, `translation:backfill` rattrape.
   */
  async queueSupplier(supplierId: number): Promise<boolean> {
    try {
      await TranslationBackfillJob.dispatch({ entities: ['product'], supplierId })
      return true
    } catch (error) {
      logger.warn({ err: error, supplierId }, 'failed to queue supplier translation')
      return false
    }
  }
}
