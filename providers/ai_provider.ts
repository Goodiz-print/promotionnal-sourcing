import type { ApplicationService } from '@adonisjs/core/types'
import aiConfig from '#config/ai'
import EmbeddingProvider from '#services/embeddings/embedding_provider'
import { embeddingProviderFor } from '#services/embeddings/provider_registry'

/**
 * Lie l'abstraction `EmbeddingProvider` au driver concret choisi par
 * `AI_PROVIDER` (config `ai`). Le driver est ainsi injectable partout
 * (`EmbeddingService`) via le conteneur IoC. Singleton : le client du provider
 * (SDK Mistral, `fetch`…) n'est instancié qu'une fois, à la première résolution.
 */
export default class AiProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(EmbeddingProvider, (resolver) => {
      return resolver.make(embeddingProviderFor(aiConfig.provider))
    })
  }
}
