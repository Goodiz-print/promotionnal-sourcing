import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import app from '@adonisjs/core/services/app'

interface IndexOrganizationProductsPayload {
  organizationId: number
}

/**
 * Aligne l'index de recherche sur la base pour tout le catalogue d'une
 * organisation (#112) : son archivage ou sa modération change la visibilité de
 * tous ses produits d'un coup. Même contrat et mêmes raisons d'import
 * dynamique que `IndexProductJob`.
 */
export default class IndexOrganizationProductsJob extends Job<IndexOrganizationProductsPayload> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 5,
  }

  async execute() {
    const { default: ProductIndexService } = await import('#services/product_index_service')
    const index = await app.container.make(ProductIndexService)
    if (!index.enabled) return

    const result = await index.syncOrganization(this.payload.organizationId)
    logger.info({ organizationId: this.payload.organizationId, ...result }, 'organization indexed')
  }

  async failed(error: Error) {
    logger.error(
      { err: error, organizationId: this.payload.organizationId },
      'organization indexing failed'
    )
  }
}
