import { readFile } from 'node:fs/promises'
import { inject } from '@adonisjs/core'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import sharp from 'sharp'
import aiConfig from '#config/ai'
import { ImageSearchDisabledError, InvalidImageError } from '#exceptions/image_search_errors'
import ImageDescriptionProvider from '#services/vision/image_description_provider'
import {
  IMAGE_SEARCH_MAX_DIMENSION,
  IMAGE_SEARCH_QUERY_MAX_LENGTH,
  type ImageDescription,
} from '#shared/types/image_search'

/**
 * Recherche par image : normalise la photo envoyée, la fait décrire en mots-clés
 * par le modèle vision, et rend le terme à injecter dans la recherche du
 * catalogue. L'image n'est ni stockée ni journalisée.
 */
@inject()
export default class ImageSearchService {
  constructor(private provider: ImageDescriptionProvider) {}

  /** Fonction active et clé Mistral présente : sinon le bouton n'est pas affiché. */
  isAvailable(): boolean {
    return aiConfig.vision.enabled && Boolean(aiConfig.mistral.apiKey)
  }

  async describe(file: MultipartFile, locale: string): Promise<ImageDescription> {
    if (!this.isAvailable()) throw new ImageSearchDisabledError()

    const image = await this.normalize(file)
    const { query } = await this.provider.describe(image, 'image/jpeg', locale)
    return { query: this.cleanQuery(query) }
  }

  /**
   * Corrige l'orientation EXIF, borne le côté, convertit en JPEG et retire les
   * métadonnées. Un contenu que sharp ne sait pas décoder n'est pas une image.
   */
  private async normalize(file: MultipartFile): Promise<Buffer> {
    try {
      const source = await readFile(file.tmpPath!)
      return await sharp(source)
        .rotate()
        .resize(IMAGE_SEARCH_MAX_DIMENSION, IMAGE_SEARCH_MAX_DIMENSION, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toBuffer()
    } catch {
      throw new InvalidImageError()
    }
  }

  private cleanQuery(query: string): string {
    return query.replace(/\s+/g, ' ').trim().slice(0, IMAGE_SEARCH_QUERY_MAX_LENGTH)
  }
}
