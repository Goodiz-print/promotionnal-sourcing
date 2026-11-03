import type { ApplicationService } from '@adonisjs/core/types'
import TranslationProvider from '#services/translation/translation_provider'
import MistralTranslationProvider from '#services/translation/mistral_translation_provider'
import ImageDescriptionProvider from '#services/vision/image_description_provider'
import MistralImageDescriptionProvider from '#services/vision/mistral_image_description_provider'

/**
 * Lie l'abstraction `TranslationProvider` au driver Mistral (voir #75). Les
 * embeddings ne passent plus par l'application : Meilisearch les calcule lui-même
 * (embedder `rest`, cf. `config/search.ts` et ADR 0002).
 */
export default class AiProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(TranslationProvider, (resolver) => {
      return resolver.make(MistralTranslationProvider)
    })
    // Recherche par image : un modèle vision décrit la photo en mots-clés.
    this.app.container.singleton(ImageDescriptionProvider, (resolver) => {
      return resolver.make(MistralImageDescriptionProvider)
    })
  }
}
