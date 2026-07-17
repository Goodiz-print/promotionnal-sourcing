import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import Product from '#models/product'
import ProductEmbeddingService from '#services/product_embedding_service'
import { resolveTranslation } from '#shared/helpers/translations'
import { DEFAULT_LOCALE } from '#shared/types/i18n'

interface GenerateProductEmbeddingJobPayload {
  productId: number
}

/**
 * Peuple `products.embedding` (vector(1024), pgvector) via Mistral
 * (`mistral-embed`) a partir du texte traduit (locale par defaut, repli sur
 * la premiere traduction disponible). Colonne SQL brute non typee par
 * l'ORM (cf. database/schema_rules.ts) => ecriture en raw SQL.
 */
@inject()
export default class GenerateProductEmbeddingJob extends Job<GenerateProductEmbeddingJobPayload> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 3,
  }

  constructor(private embeddingService: ProductEmbeddingService) {
    super()
  }

  async execute() {
    const product = await Product.query()
      .where('id', this.payload.productId)
      .preload('translations')
      .first()

    if (!product) {
      logger.warn({ productId: this.payload.productId }, 'produit introuvable, embedding annule')
      return
    }

    const translation = resolveTranslation(product.translations, DEFAULT_LOCALE)

    if (!translation) {
      logger.warn({ productId: product.id }, 'aucune traduction disponible, embedding annule')
      return
    }

    const text = [translation.name, translation.description].filter(Boolean).join(' — ')
    const embedding = await this.embeddingService.embed(text)
    const vectorLiteral = `[${embedding.join(',')}]`

    await db.rawQuery('UPDATE products SET embedding = ?::vector WHERE id = ?', [
      vectorLiteral,
      product.id,
    ])
  }

  async failed(error: Error) {
    logger.error(
      { productId: this.payload.productId, error: error.message },
      'GenerateProductEmbeddingJob failed'
    )
  }
}
