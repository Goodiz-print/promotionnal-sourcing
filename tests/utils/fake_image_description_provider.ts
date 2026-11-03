import app from '@adonisjs/core/services/app'
import aiConfig from '#config/ai'
import ImageDescriptionProvider from '#services/vision/image_description_provider'
import type { ImageDescription } from '#shared/types/image_search'
import type { Group } from '@japa/runner/core'

/**
 * Faux modèle vision : répond ce qu'on lui dit et mémorise les appels, sans
 * aucun appel réseau.
 */
export class FakeImageDescriptionProvider extends ImageDescriptionProvider {
  /** Réponse de `describe` ; `Error` pour simuler un échec du modèle. */
  response: ImageDescription | Error = { query: 'gourde inox' }
  calls: Array<{ image: Buffer; mimeType: string; locale: string }> = []

  async describe(image: Buffer, mimeType: string, locale: string): Promise<ImageDescription> {
    this.calls.push({ image, mimeType, locale })
    if (this.response instanceof Error) throw this.response
    return this.response
  }
}

/**
 * Remplace `ImageDescriptionProvider` dans le conteneur le temps de chaque test
 * du groupe et active la recherche par image (fonction + clé Mistral) ; l'état
 * d'origine de la configuration est restauré ensuite.
 */
export function useFakeImageDescription(group: Group): {
  readonly provider: FakeImageDescriptionProvider
} {
  const state = { provider: new FakeImageDescriptionProvider() }

  group.each.setup(() => {
    const previous = { enabled: aiConfig.vision.enabled, apiKey: aiConfig.mistral.apiKey }
    state.provider = new FakeImageDescriptionProvider()
    aiConfig.vision.enabled = true
    aiConfig.mistral.apiKey = 'test-key'
    app.container.swap(ImageDescriptionProvider, () => state.provider)
    return () => {
      aiConfig.vision.enabled = previous.enabled
      aiConfig.mistral.apiKey = previous.apiKey
      app.container.restore(ImageDescriptionProvider)
    }
  })

  return {
    get provider() {
      return state.provider
    },
  }
}
