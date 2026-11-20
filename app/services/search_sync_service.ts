import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import searchConfig from '#config/search'
import IndexProductJob from '#jobs/index_product_job'
import IndexOrganizationProductsJob from '#jobs/index_organization_products_job'
import IndexSupplierProductsJob from '#jobs/index_supplier_products_job'
import RefreshSearchSettingsJob from '#jobs/refresh_search_settings_job'

/**
 * Point d'entree des ecritures qui changent ce que l'index doit contenir : met
 * en queue la synchronisation du produit (ou du catalogue d'une organisation),
 * ou le rafraichissement des reglages de l'index.
 *
 * **No-op sans `MEILISEARCH_HOST`**. Un echec de mise en queue est loggue sans
 * etre propage : la base est deja a jour, et la prochaine synchronisation du
 * produit — ou `search:reindex` — rattrape l'index. Aucun appel a Meilisearch
 * dans la requete HTTP.
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

  /**
   * Met en queue la synchronisation de tous les produits d'une fiche
   * fournisseur (rattachement ou detachement de son organisation, #231).
   */
  async queueSupplier(supplierId: number): Promise<void> {
    if (!searchConfig.enabled) return
    try {
      await IndexSupplierProductsJob.dispatch({ supplierId })
    } catch (error) {
      logger.warn({ err: error, supplierId }, 'failed to queue supplier indexing')
    }
  }

  /**
   * Met en queue le rafraichissement des reglages de l'index (attributs
   * filtrables). A appeler quand `is_filter` d'un pivot categorie-attribut
   * change.
   */
  async queueSettings(): Promise<void> {
    if (!searchConfig.enabled) return
    try {
      await RefreshSearchSettingsJob.dispatch({})
    } catch (error) {
      logger.warn({ err: error }, 'failed to queue search settings refresh')
    }
  }
}
