import { inject } from '@adonisjs/core'
import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import aiConfig from '#config/ai'
import { TranslationRefusedError } from '#exceptions/ai_errors'
import { llmApiKey } from '#shared/helpers/llm'
import TranslationService from '#services/translation_service'
import type { TranslatableEntity } from '#shared/types/ai'

interface TranslateEntityPayload {
  entity: TranslatableEntity
  entityId: number
  sourceLocale: string
  targetLocales: string[]
}

/**
 * Traduit une entité (produit, catégorie, attribut, valeur d'attribut) de sa
 * locale source vers `targetLocales`, en un seul appel IA (#75). **Rejouable
 * sans surcoût** : `TranslationService` saute l'appel si les clés d'idempotence
 * sont inchangées (retry, crash, redéploiement). No-op tant que
 * `ai.translation.enabled` est faux ou que la clé du fournisseur actif
 * (`AI_LLM_PROVIDER`) manque : la traduction est alors indisponible, sans échec
 * ni réessai. Un refus du modèle n'est pas rejoué non plus (même réponse, refacturée).
 *
 * Pas d'import de modèle Lucid (les jobs sont chargés au boot) : le service
 * passe par `db`. Voir la règle DI de `CLAUDE.md`.
 */
@inject()
export default class TranslateEntityJob extends Job<TranslateEntityPayload> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 3,
  }

  constructor(private translations: TranslationService) {
    super()
  }

  async execute() {
    if (!aiConfig.translation.enabled) return

    const { entity, entityId, sourceLocale, targetLocales } = this.payload
    if (!llmApiKey(aiConfig)) {
      logger.warn(
        { provider: aiConfig.provider, entity, entityId },
        'translation skipped: no API key for the active AI provider'
      )
      return
    }

    try {
      await this.translations.translate({ entity, entityId, sourceLocale, targetLocales })
    } catch (error) {
      if (!(error instanceof TranslationRefusedError)) throw error
      logger.warn({ entity, entityId }, 'translation refused by the model, not retried')
    }
  }

  async failed(error: Error) {
    logger.error(
      { err: error, entity: this.payload.entity, entityId: this.payload.entityId },
      'translate entity failed'
    )
  }
}
