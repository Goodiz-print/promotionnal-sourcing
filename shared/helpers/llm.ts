import {
  CLAUDE_IMAGE_MEDIA_TYPES,
  LLM_PROVIDERS,
  type ClaudeImageMediaType,
  type LlmApiKeys,
  type LlmCredentials,
  type LlmProvider,
  type LlmPricing,
  type TranslationUsage,
} from '#shared/types/ai'

type JsonSchema = Record<string, unknown>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Fournisseur utilisé : le premier de `LLM_PROVIDERS` (Claude, puis Mistral) dont
 * la clé d'API est présente. Sans aucune clé, le premier de la liste : l'IA est
 * alors indisponible (`llmApiKey` rend `undefined`).
 */
export function resolveLlmProvider(apiKeys: LlmApiKeys): LlmProvider {
  return LLM_PROVIDERS.find((provider) => Boolean(apiKeys[provider])) ?? LLM_PROVIDERS[0]
}

/** Clé d'API du fournisseur de modèle de langage actif (`undefined` : IA indisponible). */
export function llmApiKey(config: LlmCredentials): string | undefined {
  return config[config.provider].apiKey || undefined
}

/** Parse du JSON sans lever : `undefined` si le texte n'en est pas. */
export function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** Objet JSON Schema strict : toutes les propriétés requises, aucune autre admise. */
function strictObject(properties: Record<string, JsonSchema>): JsonSchema {
  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  }
}

/**
 * Schéma de la réponse de traduction `{ locale: { champ: texte } }`, pour la
 * sortie structurée de Claude : chaque locale et chaque champ demandés sont requis.
 */
export function translationSchema(fields: string[], locales: string[]): JsonSchema {
  const localized = strictObject(
    Object.fromEntries(fields.map((field) => [field, { type: 'string' }]))
  )
  return strictObject(Object.fromEntries(locales.map((locale) => [locale, localized])))
}

/** Schéma de la réponse de description d'image `{ query }`. */
export function imageQuerySchema(): JsonSchema {
  return strictObject({ query: { type: 'string' } })
}

/**
 * Première anomalie d'une réponse de traduction (locale absente, puis champ absent
 * ou non textuel), ou `null` si chaque locale porte chaque champ.
 */
export function translationShapeError(
  parsed: unknown,
  fields: string[],
  locales: string[]
): string | null {
  const byLocale = isRecord(parsed) ? parsed : {}
  const missingLocale = locales.find((locale) => !isRecord(byLocale[locale]))
  if (missingLocale) return `missing locale "${missingLocale}"`

  const [missing] = locales.flatMap((locale) =>
    fields
      .filter((field) => typeof (byLocale[locale] as Record<string, unknown>)[field] !== 'string')
      .map((field) => `missing field "${field}" for "${locale}"`)
  )
  return missing ?? null
}

/**
 * Ne garde d'une réponse **déjà validée** (`translationShapeError`) que les locales
 * et les champs demandés.
 */
export function pickTranslations(
  parsed: Record<string, Record<string, string>>,
  fields: string[],
  locales: string[]
): Record<string, Record<string, string>> {
  return Object.fromEntries(
    locales.map((locale) => [
      locale,
      Object.fromEntries(fields.map((field) => [field, parsed[locale][field]])),
    ])
  )
}

/**
 * Texte d'une réponse Claude : ses blocs `text` mis bout à bout. Les blocs
 * `thinking` (qui peuvent précéder la réponse) sont ignorés.
 */
export function claudeText(blocks: ReadonlyArray<{ type: string; text?: unknown }>): string {
  return blocks
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('')
}

/** Type MIME tel que l'attend l'API Claude, ou `null` s'il n'est pas accepté. */
export function claudeImageMediaType(mimeType: string): ClaudeImageMediaType | null {
  return CLAUDE_IMAGE_MEDIA_TYPES.find((type) => type === mimeType) ?? null
}

/**
 * Coût estimé d'un volume de tokens au tarif donné (par million de tokens), ou
 * `null` tant que le tarif d'entrée ou de sortie n'est pas renseigné.
 */
export function estimateLlmCost(usage: TranslationUsage, pricing: LlmPricing): number | null {
  const { inputPerMillion, outputPerMillion } = pricing
  if (inputPerMillion === undefined || outputPerMillion === undefined) return null
  return (
    (usage.promptTokens * inputPerMillion + usage.completionTokens * outputPerMillion) / 1_000_000
  )
}
