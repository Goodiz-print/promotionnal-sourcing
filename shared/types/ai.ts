/**
 * Providers d'embeddings supportés. `mistral` utilise le SDK natif ;
 * `openai-compatible` est un driver générique HTTP qui parle le protocole
 * OpenAI `/embeddings` (OpenAI, Together, Groq, Ollama, vLLM, LM Studio…).
 */
export const AI_PROVIDERS = ['mistral', 'openai-compatible'] as const

export type AiProvider = (typeof AI_PROVIDERS)[number]

/**
 * Le contrat des providers d'embeddings est la **classe abstraite**
 * `app/services/embeddings/embedding_provider.ts` (token d'injection IoC), pas
 * une interface — voir la règle DI de `CLAUDE.md`.
 */

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
