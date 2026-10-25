import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import app from '@adonisjs/core/services/app'

interface IndexProductPayload {
  productId: number
}

/**
 * Aligne l'index de recherche sur la base pour un produit (#112) : réécrit son
 * document s'il est visible, le retire sinon (y compris supprimé). Dispatché par
 * `SearchSyncService` à chaque écriture qui change ce que l'index doit contenir.
 *
 * **Idempotent** : le document est reconstruit depuis PostgreSQL à chaque
 * exécution, jamais depuis le payload — un doublon ou un rejeu après échec
 * redonne le même index, et le dernier passage reflète l'état courant.
 *
 * ⚠️ Exception à la règle « imports en haut du fichier » : `ProductIndexService`
 * importe le **modèle** `Product`, et la queue charge les modules de job **au
 * boot** (`loadJobs`) — évaluer un modèle Lucid à ce stade casse le service
 * `hash`. Le service est donc importé et résolu dans `execute()`, comme
 * `ExpireRfqsJob`. Voir la règle DI de `CLAUDE.md`.
 */
export default class IndexProductJob extends Job<IndexProductPayload> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 5,
  }

  async execute() {
    const { default: ProductIndexService } = await import('#services/product_index_service')
    const index = await app.container.make(ProductIndexService)
    if (!index.enabled) return

    const result = await index.sync([this.payload.productId])
    logger.info({ productId: this.payload.productId, ...result }, 'product indexed')
  }

  async failed(error: Error) {
    logger.error({ err: error, productId: this.payload.productId }, 'product indexing failed')
  }
}
