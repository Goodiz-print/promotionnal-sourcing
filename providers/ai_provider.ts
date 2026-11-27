import type { ApplicationService } from '@adonisjs/core/types'
import Anthropic from '@anthropic-ai/sdk'
import aiConfig from '#config/ai'
import TranslationProvider from '#services/translation/translation_provider'
import MistralTranslationProvider from '#services/translation/mistral_translation_provider'
import ClaudeTranslationProvider from '#services/translation/claude_translation_provider'
import ImageDescriptionProvider from '#services/vision/image_description_provider'
import MistralImageDescriptionProvider from '#services/vision/mistral_image_description_provider'
import ClaudeImageDescriptionProvider from '#services/vision/claude_image_description_provider'
import type { LlmProvider } from '#shared/types/ai'

/** Driver de traduction de chaque fournisseur (`AI_LLM_PROVIDER`). */
export const TRANSLATION_DRIVERS = {
  mistral: MistralTranslationProvider,
  claude: ClaudeTranslationProvider,
} satisfies Record<LlmProvider, new (...args: never[]) => TranslationProvider>

/** Driver de description d'image de chaque fournisseur (`AI_LLM_PROVIDER`). */
export const IMAGE_DESCRIPTION_DRIVERS = {
  mistral: MistralImageDescriptionProvider,
  claude: ClaudeImageDescriptionProvider,
} satisfies Record<LlmProvider, new (...args: never[]) => ImageDescriptionProvider>

/**
 * Lie les abstractions `TranslationProvider` (#75) et `ImageDescriptionProvider`
 * au driver du fournisseur choisi par `AI_LLM_PROVIDER` (Mistral par défaut, ou
 * Claude — ADR 0006). Les embeddings ne passent pas par ici : Meilisearch les
 * calcule lui-même (embedder `rest`, cf. `config/search.ts` et ADR 0002).
 */
export default class AiProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    // Client de l'API Anthropic, partagé par les drivers Claude et la sonde de santé.
    // Construit à la première résolution ; sans clé, c'est l'appel qui échoue.
    this.app.container.singleton(Anthropic, () => {
      return new Anthropic({ apiKey: aiConfig.claude.apiKey })
    })
    this.app.container.singleton(TranslationProvider, (resolver) => {
      return resolver.make(TRANSLATION_DRIVERS[aiConfig.provider])
    })
    // Recherche par image : un modèle vision décrit la photo en mots-clés.
    this.app.container.singleton(ImageDescriptionProvider, (resolver) => {
      return resolver.make(IMAGE_DESCRIPTION_DRIVERS[aiConfig.provider])
    })
  }
}
