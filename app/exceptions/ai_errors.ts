import { Exception } from '@adonisjs/core/exceptions'

/**
 * `AI_PROVIDER` configuré ne correspond à aucun driver connu.
 */
export class UnknownAiProviderError extends Exception {
  static status = 500
  static code = 'E_UNKNOWN_AI_PROVIDER'

  constructor(provider: string) {
    super(`Unknown AI provider "${provider}" (set AI_PROVIDER to a supported value)`, {
      code: 'E_UNKNOWN_AI_PROVIDER',
      status: 500,
    })
  }
}

/**
 * Échec d'appel à l'API d'embeddings d'un provider.
 */
export class EmbeddingProviderError extends Exception {
  static status = 502
  static code = 'E_EMBEDDING_PROVIDER'

  constructor(provider: string, detail: string) {
    super(`Embedding provider "${provider}" failed: ${detail}`, {
      code: 'E_EMBEDDING_PROVIDER',
      status: 502,
    })
  }
}

/**
 * Le provider a renvoyé un vecteur d'une dimension incompatible avec la colonne
 * `products.embedding` (figée à 1024). Le provider doit être configuré pour
 * produire la bonne dimension (réduction).
 */
export class EmbeddingDimensionError extends Exception {
  static status = 500
  static code = 'E_EMBEDDING_DIMENSION'

  constructor(got: number, expected: number) {
    super(
      `Embedding dimension mismatch: got ${got}, expected ${expected}. ` +
        `Configure the provider/model to output ${expected} dimensions.`,
      { code: 'E_EMBEDDING_DIMENSION', status: 500 }
    )
  }
}

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
