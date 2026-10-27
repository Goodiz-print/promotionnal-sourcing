import { inject } from '@adonisjs/core'
import SearchSyncService from '#services/search_sync_service'
import type ProductChanged from '#events/product_changed'

/**
 * Met en queue la synchronisation de l'index de recherche du produit (no-op sans
 * `ELASTICSEARCH_URL`).
 */
@inject()
export default class OnProductChanged {
  constructor(private sync: SearchSyncService) {}

  async handle({ productId }: ProductChanged) {
    await this.sync.queueProduct(productId)
  }
}
