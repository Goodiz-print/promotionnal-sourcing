import type { ImageDescription } from '#shared/types/image_search'

/**
 * Abstraction « modèle vision » : décrit une image en mots-clés de recherche.
 * Jeton d'injection (les interfaces n'existent pas au runtime) lié à son
 * implémentation dans `providers/ai_provider.ts`.
 */
export default abstract class ImageDescriptionProvider {
  /** Décrit `image` (JPEG/PNG/WebP) dans la langue `locale`. */
  abstract describe(image: Buffer, mimeType: string, locale: string): Promise<ImageDescription>
}
