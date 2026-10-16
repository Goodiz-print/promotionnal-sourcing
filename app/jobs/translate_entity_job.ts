import { inject } from '@adonisjs/core'
import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import aiConfig from '#config/ai'
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
 * `ai.translation.enabled` est faux.
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
    await this.translations.translate({ entity, entityId, sourceLocale, targetLocales })
  }

  async failed(error: Error) {
    logger.error(
      { err: error, entity: this.payload.entity, entityId: this.payload.entityId },
      'translate entity failed'
    )
  }
}
