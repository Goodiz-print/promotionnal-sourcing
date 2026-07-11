import aiConfig from '#config/ai'
import MistralEmbeddingProvider from '#services/embeddings/mistral_provider'
import OpenAiCompatibleEmbeddingProvider from '#services/embeddings/openai_compatible_provider'
import { UnknownAiProviderError } from '#exceptions/ai_errors'
import type { AiProvider, EmbeddingProvider } from '#shared/types/ai'

/**
 * Résout le driver d'embeddings à partir de `AI_PROVIDER` (config `ai`).
 * Lève `UnknownAiProviderError` pour une valeur non supportée.
 */
export function resolveEmbeddingProvider(provider: string = aiConfig.provider): EmbeddingProvider {
  switch (provider as AiProvider) {
    case 'mistral':
      return new MistralEmbeddingProvider()
    case 'openai-compatible':
      return new OpenAiCompatibleEmbeddingProvider()
    default:
      throw new UnknownAiProviderError(provider)
  }
}
