/**
 * Entités traduisibles par Mistral : table de traduction, clé étrangère et
 * champs texte traduits (registre dans `TranslationService`).
 */
export const TRANSLATABLE_ENTITIES = [
  'product',
  'category',
  'attribute',
  'attribute_value',
  'certification',
  'marking_technique',
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

/** Options du rattrapage des traductions (`translation:backfill`). */
export interface TranslationBackfillOptions {
  /** Types d'entité à traiter ; tous par défaut. */
  entities?: readonly TranslatableEntity[]
  /** Nombre maximum d'entités mises en file **par type** (échantillon de mesure). */
  limit?: number
}

/**
 * Résultat du rattrapage : entités réellement mises en file, par type, et
 * `failed` si la file a refusé un job (le rattrapage s'arrête alors, il est
 * relançable sans surcoût).
 */
export interface TranslationBackfillReport {
  queued: Record<TranslatableEntity, number>
  failed: boolean
}

/** `called` si Mistral a été appelé, `skipped` si toutes les locales étaient à jour. */
export type TranslationOutcome = 'called' | 'skipped'

/** Morceau de message multimodal (texte ou image en URL / data URL). */
export type MistralContentChunk =
  { type: 'text'; text: string } | { type: 'image_url'; imageUrl: string }

/** Sous-ensemble du SDK Mistral dont dépendent le traducteur et la vision (injectable en test). */
export interface MistralChatClientLike {
  chat: {
    complete(request: {
      model: string
      messages: Array<{ role: 'system' | 'user'; content: string | MistralContentChunk[] }>
      responseFormat: { type: 'json_object' }
      temperature: number
      maxTokens: number
    }): Promise<{
      choices: Array<{ message: { content?: unknown }; finishReason?: unknown }>
    }>
  }
}
