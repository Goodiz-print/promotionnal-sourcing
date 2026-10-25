/**
 * Entités traduisibles par Mistral : table de traduction, clé étrangère et
 * champs texte traduits (registre dans `TranslationService`).
 */
export const TRANSLATABLE_ENTITIES = [
  'product',
  'category',
  'attribute',
  'attribute_value',
] as const

export type TranslatableEntity = (typeof TRANSLATABLE_ENTITIES)[number]

/**
 * Une entité à traduire dans plusieurs locales. Toutes les locales cibles sont
 * traduites par **un seul** appel IA (#75).
 */
export interface TranslationTarget {
  entity: TranslatableEntity
  entityId: number
  sourceLocale: string
  targetLocales: string[]
}

/** `called` si Mistral a été appelé, `skipped` si toutes les locales étaient à jour. */
export type TranslationOutcome = 'called' | 'skipped'

/** Sous-ensemble du SDK Mistral dont dépend le traducteur (injectable en test). */
export interface MistralChatClientLike {
  chat: {
    complete(request: {
      model: string
      messages: Array<{ role: 'system' | 'user'; content: string }>
      responseFormat: { type: 'json_object' }
      temperature: number
    }): Promise<{ choices: Array<{ message: { content?: unknown } }> }>
  }
}
