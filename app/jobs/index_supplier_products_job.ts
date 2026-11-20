import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import app from '@adonisjs/core/services/app'

interface IndexSupplierProductsPayload {
  supplierId: number
}

/**
 * Aligne l'index de recherche sur la base pour tous les produits d'une fiche
 * fournisseur : son rattachement à une organisation, ou son détachement (#231),
 * change l'organisation de tout son catalogue. Par fiche et non par
 * organisation : après un détachement, la fiche n'en a plus. Même contrat et
 * mêmes raisons d'import dynamique que `IndexProductJob`.
 */
export default class IndexSupplierProductsJob extends Job<IndexSupplierProductsPayload> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 5,
  }

  async execute() {
    const { default: ProductIndexService } = await import('#services/product_index_service')
    const index = await app.container.make(ProductIndexService)
    if (!index.enabled) return

    const result = await index.syncSupplier(this.payload.supplierId)
    logger.info({ supplierId: this.payload.supplierId, ...result }, 'supplier indexed')
  }

  async failed(error: Error) {
    logger.error({ err: error, supplierId: this.payload.supplierId }, 'supplier indexing failed')
  }
}
