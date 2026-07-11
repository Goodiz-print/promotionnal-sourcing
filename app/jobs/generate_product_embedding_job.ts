import { inject } from '@adonisjs/core'
import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import EmbeddingService from '#services/embedding_service'
import aiConfig from '#config/ai'

interface GenerateProductEmbeddingPayload {
  productId: number
}

/**
 * Calcule l'embedding d'un produit (via le provider configuré) et le persiste
 * dans `products.embedding` (pgvector) pour la recherche sémantique. Dispatché
 * à la création / mise à jour d'un produit fournisseur.
 *
 * `EmbeddingService` est **injecté** (le conteneur instancie le job).
 * **No-op** tant que `ai.embeddings.enabled` est faux (dev / test / CI).
 *
 * ⚠️ Exception à la règle « imports en haut du fichier » : le **modèle** `Product`
 * est importé **dynamiquement** dans `execute()`. La queue charge les modules de
 * job **au boot** (`loadJobs`), or importer un modèle Lucid à ce stade évalue le
 * modèle `User` (via ses relations) alors que le service `hash` de `@adonisjs/auth`
 * n'est pas encore prêt → hachage cassé au seeding. Les **services** (ici
 * `EmbeddingService`, qui n'importe `Product` qu'en `type`) restent injectés
 * statiquement. Voir la règle DI de `CLAUDE.md`.
 */
@inject()
export default class GenerateProductEmbeddingJob extends Job<GenerateProductEmbeddingPayload> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 3,
  }

  constructor(private embeddings: EmbeddingService) {
    super()
  }

  async execute() {
    if (!aiConfig.embeddings.enabled) return

    const { default: Product } = await import('#models/product')
    const product = await Product.query()
      .where('id', this.payload.productId)
      .preload('translations')
      .first()
    if (!product) return

    await this.embeddings.embedAndStore(product)
  }

  async failed(error: Error) {
    logger.error(
      { err: error, productId: this.payload.productId },
      'generate product embedding failed'
    )
  }
}
