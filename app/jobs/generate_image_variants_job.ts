import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import app from '@adonisjs/core/services/app'

interface GenerateImageVariantsPayload {
  productImageId: number
}

/**
 * Génère les variantes (carte, fiche, zoom) d'une image de galerie, dispatché
 * après son rattachement à un produit. L'original reste servi tant que les
 * variantes manquent : un échec est loggé et ne bloque jamais le produit.
 *
 * ⚠️ Exception à la règle « imports en haut du fichier » : la queue charge les
 * modules de job **au boot** (`loadJobs`), or `ImageVariantService` importe des
 * **modèles Lucid** — l'évaluer à ce stade casse la résolution du service
 * `hash` (`@adonisjs/auth`). Le service est donc importé et résolu dans
 * `execute()`, à l'image de `DeleteStorageObjectJob`. Voir la règle DI de
 * `CLAUDE.md`.
 */
export default class GenerateImageVariantsJob extends Job<GenerateImageVariantsPayload> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 3,
  }

  async execute() {
    const { default: ImageVariantService } = await import('#services/image_variant_service')
    const variants = await app.container.make(ImageVariantService)

    await variants.generate(this.payload.productImageId)
  }

  async failed(error: Error) {
    logger.error(
      { err: error, productImageId: this.payload.productImageId },
      'generate image variants failed'
    )
  }
}
