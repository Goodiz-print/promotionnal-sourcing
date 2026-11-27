import { Exception } from '@adonisjs/core/exceptions'

/**
 * Échec ou réponse inexploitable de l'API de traduction.
 */
export class TranslationProviderError extends Exception {
  static status = 502
  static code = 'E_TRANSLATION_PROVIDER'

  constructor(detail: string) {
    super(`Translation provider failed: ${detail}`, { code: 'E_TRANSLATION_PROVIDER', status: 502 })
  }
}

/**
 * Réponse tronquée par le plafond de sortie (`finish_reason = length` chez Mistral,
 * `stop_reason = max_tokens` chez Claude) : rejouer
 * le même appel échouerait de la même façon, le service réduit donc le lot.
 */
export class TranslationTruncatedError extends TranslationProviderError {
  constructor() {
    super('response truncated')
  }
}

/**
 * Aucune traduction source pour l'entité dans la locale source demandée.
 */
export class MissingTranslationSourceError extends Exception {
  static status = 422
  static code = 'E_TRANSLATION_SOURCE_MISSING'

  constructor(entity: string, entityId: number, locale: string) {
    super(`No "${locale}" source translation for ${entity} #${entityId}`, {
      code: 'E_TRANSLATION_SOURCE_MISSING',
      status: 422,
    })
  }
}
