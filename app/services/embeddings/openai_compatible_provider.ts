import aiConfig from '#config/ai'
import { EmbeddingProviderError } from '#exceptions/ai_errors'
import EmbeddingProvider from '#services/embeddings/embedding_provider'
import type { FetchLike } from '#shared/types/ai'

/**
 * Driver d'embeddings générique parlant le protocole **OpenAI** (`POST
 * {baseUrl}/embeddings`). Couvre OpenAI et tout service compatible (Together,
 * Groq, Ollama, vLLM, LM Studio…) via `AI_BASE_URL` / `AI_API_KEY` /
 * `AI_EMBED_MODEL`. Demande la dimension configurée via `dimensions` (réduction
 * côté API pour les modèles qui le supportent).
 *
 * `fetch` est injecté (testabilité — aucun appel réseau en test).
 */
export default class OpenAiCompatibleEmbeddingProvider extends EmbeddingProvider {
  readonly name = 'openai-compatible' as const

  constructor(private fetchFn: FetchLike = fetch as unknown as FetchLike) {
    super()
  }

  async embed(text: string): Promise<number[]> {
    const { baseUrl, apiKey, model } = aiConfig.openaiCompatible

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`

    const response = await this.fetchFn(`${baseUrl.replace(/\/+$/, '')}/embeddings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, input: text, dimensions: aiConfig.embeddings.dimensions }),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new EmbeddingProviderError(
        'openai-compatible',
        `HTTP ${response.status} ${detail}`.trim()
      )
    }

    const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> }
    const embedding = payload.data?.[0]?.embedding
    if (!embedding) throw new EmbeddingProviderError('openai-compatible', 'empty response')
    return embedding
  }
}
