import type { ApplicationService } from '@adonisjs/core/types'
import TranslationProvider from '#services/translation/translation_provider'
import MistralTranslationProvider from '#services/translation/mistral_translation_provider'

/**
 * Lie l'abstraction `TranslationProvider` au driver Mistral (voir #75). Les
 * embeddings ne passent plus par l'application : Elasticsearch les calcule lui-même
 * (endpoint d'inférence, cf. `config/search.ts` et ADR 0004).
 */
export default class AiProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(TranslationProvider, (resolver) => {
      return resolver.make(MistralTranslationProvider)
    })
  }
}
