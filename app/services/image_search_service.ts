import { readFile } from 'node:fs/promises'
import { inject } from '@adonisjs/core'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import logger from '@adonisjs/core/services/logger'
import sharp from 'sharp'
import { ImageSearchDisabledError, InvalidImageError } from '#exceptions/image_search_errors'
import ImageDescriptionProvider from '#services/vision/image_description_provider'
import { isImageSearchAvailable } from '#services/vision/image_search_availability'
import {
  IMAGE_SEARCH_MAX_DIMENSION,
  IMAGE_SEARCH_MAX_INPUT_PIXELS,
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

  async describe(file: MultipartFile, locale: string): Promise<ImageDescription> {
    if (!isImageSearchAvailable()) throw new ImageSearchDisabledError()

    const image = await this.normalize(file)
    const { query } = await this.provider.describe(image, 'image/jpeg', locale)
    return { query: this.cleanQuery(query) }
  }

  /**
   * Corrige l'orientation EXIF, borne le côté, convertit en JPEG et retire les
   * métadonnées. Seul un échec de **décodage** vaut « image invalide » : une
   * erreur de lecture du fichier temporaire est une panne serveur et remonte.
   */
  private async normalize(file: MultipartFile): Promise<Buffer> {
    if (!file.tmpPath) throw new Error('Uploaded image has no temporary path')
    const source = await readFile(file.tmpPath)

    try {
      return await sharp(source, { limitInputPixels: IMAGE_SEARCH_MAX_INPUT_PIXELS })
        .rotate()
        .resize(IMAGE_SEARCH_MAX_DIMENSION, IMAGE_SEARCH_MAX_DIMENSION, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toBuffer()
    } catch (error) {
      logger.warn({ err: error }, 'image search: image could not be decoded')
      throw new InvalidImageError()
    }
  }

  private cleanQuery(query: string): string {
    return query.replace(/\s+/g, ' ').trim().slice(0, IMAGE_SEARCH_QUERY_MAX_LENGTH)
  }
}
