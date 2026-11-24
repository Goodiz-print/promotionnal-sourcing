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

/** Tables de traduction et champs texte traduits, par type d'entité. */
export const ENTITY_TRANSLATION_TABLES: Record<
  TranslatableEntity,
  { table: string; foreignKey: string; parentTable: string; fields: readonly string[] }
> = {
  product: {
    table: 'product_translations',
    foreignKey: 'product_id',
    parentTable: 'products',
    fields: ['name', 'description'],
  },
  category: {
    table: 'category_translations',
    foreignKey: 'category_id',
    parentTable: 'categories',
    fields: ['name'],
  },
  attribute: {
    table: 'attribute_translations',
    foreignKey: 'attribute_id',
    parentTable: 'attributes',
    fields: ['name'],
  },
  attribute_value: {
    table: 'attribute_value_translations',
    foreignKey: 'attribute_value_id',
    parentTable: 'attribute_values',
    fields: ['label'],
  },
  certification: {
    table: 'certification_translations',
    foreignKey: 'certification_id',
    parentTable: 'certifications',
    fields: ['name'],
  },
  marking_technique: {
    table: 'marking_technique_translations',
    foreignKey: 'marking_technique_id',
    parentTable: 'marking_techniques',
    fields: ['name'],
  },
}

/** Tokens consommés par un appel IA (remplis par le fournisseur quand l'API les renvoie). */
export interface TranslationUsage {
  promptTokens: number
  completionTokens: number
}

/** Durée de conservation du journal des appels IA (jours) : au-delà, les lignes sont purgées. */
export const AI_CALL_RETENTION_DAYS = 90

/** Services IA journalisés dans `ai_calls`. */
export const AI_SERVICES = ['translation'] as const
export type AiService = (typeof AI_SERVICES)[number]

/** `truncated` : réponse coupée par le plafond de sortie (le lot est alors scindé). */
export const AI_CALL_STATUSES = ['success', 'truncated', 'failed'] as const
export type AiCallStatus = (typeof AI_CALL_STATUSES)[number]

/** Un appel au fournisseur IA, tel qu'enregistré dans `ai_calls`. */
export interface AiCallRecord {
  service: AiService
  model: string
  entity: TranslatableEntity | null
  entityId: number | null
  sourceLocale: string | null
  targetLocales: string[]
  usage: TranslationUsage
  durationMs: number
  status: AiCallStatus
  error: string | null
}

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
  /**
   * Restreint les produits à ceux d'une fiche fournisseur : traduction du
   * catalogue d'une fiche qui vient d'être rattachée, donc publiée (#240).
   */
  supplierId?: number
}

/** Lot d'entités à rattraper : après `afterId`, au plus `size`, éventuellement d'une fiche. */
export interface TranslationBackfillBatch {
  afterId: number
  size: number
  supplierId?: number
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
      usage?: { promptTokens?: number; completionTokens?: number }
    }>
  }
}
