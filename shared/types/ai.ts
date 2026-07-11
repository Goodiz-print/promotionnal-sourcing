/**
 * Providers d'embeddings supportés. `mistral` utilise le SDK natif ;
 * `openai-compatible` est un driver générique HTTP qui parle le protocole
 * OpenAI `/embeddings` (OpenAI, Together, Groq, Ollama, vLLM, LM Studio…).
 */
export const AI_PROVIDERS = ['mistral', 'openai-compatible'] as const

export type AiProvider = (typeof AI_PROVIDERS)[number]

/**
 * Contrat commun à tous les providers d'embeddings. Un provider renvoie le
 * vecteur brut ; la validation de dimension et la persistance sont gérées par
 * `EmbeddingService`.
 */
export interface EmbeddingProvider {
  /** Nom du provider (pour les messages d'erreur / logs). */
  readonly name: AiProvider
  /** Embedding d'un texte non vide. Lève en cas d'échec API. */
  embed(text: string): Promise<number[]>
}

/**
 * Sous-ensemble de `fetch` dont dépend le driver OpenAI-compatible (permet
 * d'injecter un faux client HTTP en test — aucun appel réseau).
 */
export interface HttpResponseLike {
  ok: boolean
  status: number
  json(): Promise<unknown>
  text(): Promise<string>
}

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string }
) => Promise<HttpResponseLike>
