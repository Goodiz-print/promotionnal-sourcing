import logger from '@adonisjs/core/services/logger'
import type {
  FeedRequestContext,
  FetchCatalogueOptions,
  NormalizedProduct,
  SupplierFeedIdentity,
  SupplierFeedKey,
} from '#shared/types/supplier_feed'

/**
 * Connecteur d'un fournisseur : lit son flux (API, JSON, XML…) et le traduit en
 * `NormalizedProduct`, sans rien écrire en base (c'est le rôle de
 * `SupplierCatalogueImporter`). Une implémentation par fournisseur, résolue par
 * clé via `SupplierConnectorRegistry`.
 */
export default abstract class SupplierConnector {
  abstract readonly key: SupplierFeedKey

  /** Fiche fournisseur créée / mise à jour à l'import. */
  abstract readonly identity: SupplierFeedIdentity

  /** Les identifiants requis sont-ils présents dans l'environnement ? */
  abstract isConfigured(): boolean

  /**
   * Catalogue normalisé, au plus `limit` produits (`null` = catalogue entier). Lève
   * `SupplierConnectorNotConfiguredException` sans identifiants.
   */
  abstract fetchCatalogue(options: FetchCatalogueOptions): Promise<NormalizedProduct[]>

  /**
   * Lit un flux annexe (prix, stock, marquage…). En échec (pas encore activé
   * côté fournisseur, timeout…), il est journalisé, signalé par
   * `onMissingFeed` et remplacé par `null` : le catalogue reste lisible, mais
   * l'importeur refuse d'écrire un import intégral amputé d'un flux (il
   * écraserait prix, déclinaisons ou marquages existants par du vide).
   */
  protected async optional(
    feed: string,
    context: FeedRequestContext,
    load: () => Promise<unknown>
  ): Promise<unknown> {
    try {
      return await load()
    } catch (error) {
      logger.warn({ supplier: this.key, feed, err: error }, 'supplier optional feed unavailable')
      context.onMissingFeed?.(feed)
      return null
    }
  }
}
