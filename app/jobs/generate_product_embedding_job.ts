import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'

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
 *
 * Les dépendances (modèles, service, config) sont importées **dynamiquement**
 * dans `execute()` : la queue charge ce module au boot (`loadJobs`) et des
 * imports statiques de modèles/services résoudraient trop tôt les singletons
 * `@adonisjs/core/services/*` (avant l'enregistrement des providers).
 */
export default class GenerateProductEmbeddingJob extends Job<GenerateProductEmbeddingPayload> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 3,
  }

  async execute() {
    const { default: aiConfig } = await import('#config/ai')
    if (!aiConfig.embeddings.enabled) return

    const { default: Product } = await import('#models/product')
    const { default: EmbeddingService } = await import('#services/embedding_service')
    const { default: app } = await import('@adonisjs/core/services/app')

    const product = await Product.query()
      .where('id', this.payload.productId)
      .preload('translations')
      .first()
    if (!product) return

    const service = await app.container.make(EmbeddingService)
    await service.embedAndStore(product)
  }

  async failed(error: Error) {
    const { default: logger } = await import('@adonisjs/core/services/logger')
    logger.error(
      { err: error, productId: this.payload.productId },
      'generate product embedding failed'
    )
  }
}
