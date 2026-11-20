import type {
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
}
