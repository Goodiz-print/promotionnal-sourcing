import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import searchConfig from '#config/search'
import IndexProductJob from '#jobs/index_product_job'
import IndexOrganizationProductsJob from '#jobs/index_organization_products_job'

/**
 * Point d'entrée des écritures qui changent ce que l'index doit contenir : met
 * en queue la synchronisation du produit (ou du catalogue d'une organisation).
 *
 * **No-op sans `ELASTICSEARCH_URL`**. Un échec de mise en queue est loggué sans
 * être propagé : la base est déjà à jour, et la prochaine synchronisation du
 * produit — ou `search:reindex` — rattrape l'index. Aucun appel à Elasticsearch
 * dans la requête HTTP.
 */
@inject()
export default class SearchSyncService {
  async queueProduct(productId: number): Promise<void> {
    if (!searchConfig.enabled) return
    try {
      await IndexProductJob.dispatch({ productId })
    } catch (error) {
      logger.warn({ err: error, productId }, 'failed to queue product indexing')
    }
  }

  async queueOrganization(organizationId: number): Promise<void> {
    if (!searchConfig.enabled) return
    try {
      await IndexOrganizationProductsJob.dispatch({ organizationId })
    } catch (error) {
      logger.warn({ err: error, organizationId }, 'failed to queue organization indexing')
    }
  }
}
