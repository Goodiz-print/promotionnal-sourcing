import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import Product from '#models/product'
import EmbeddingService from '#services/embedding_service'
import aiConfig from '#config/ai'

interface GenerateProductEmbeddingPayload {
  productId: number
}

/**
 * Calcule l'embedding Mistral d'un produit et le persiste dans
 * `products.embedding` (pgvector) pour la recherche sémantique. Dispatché à la
 * création / mise à jour d'un produit fournisseur.
 *
 * **No-op** tant que `ai.embeddings.enabled` est faux (dev / test / CI) : aucun
 * appel réseau. La génération réelle n'a lieu qu'en production.
 */
export default class GenerateProductEmbeddingJob extends Job<GenerateProductEmbeddingPayload> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 3,
  }

  async execute() {
    if (!aiConfig.embeddings.enabled) return

    const product = await Product.query()
      .where('id', this.payload.productId)
      .preload('translations')
      .first()
    if (!product) return

    const service = new EmbeddingService()
    await service.embedAndStore(product)
  }

  async failed(error: Error) {
    logger.error(
      { err: error, productId: this.payload.productId },
      'generate product embedding failed'
    )
  }
}
