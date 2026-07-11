import MistralEmbeddingProvider from '#services/embeddings/mistral_provider'
import OpenAiCompatibleEmbeddingProvider from '#services/embeddings/openai_compatible_provider'
import { UnknownAiProviderError } from '#exceptions/ai_errors'
import type EmbeddingProvider from '#services/embeddings/embedding_provider'

/**
 * Classe du driver d'embeddings pour un `AI_PROVIDER` donné. Renvoie le
 * **constructeur** (pas une instance) : c'est le conteneur IoC qui instancie le
 * driver (`resolver.make(...)` dans `providers/ai_provider.ts`). Lève
 * `UnknownAiProviderError` pour une valeur non supportée.
 */
export function embeddingProviderFor(provider: string): new () => EmbeddingProvider {
  switch (provider) {
    case 'mistral':
      return MistralEmbeddingProvider
    case 'openai-compatible':
      return OpenAiCompatibleEmbeddingProvider
    default:
      throw new UnknownAiProviderError(provider)
  }
}
