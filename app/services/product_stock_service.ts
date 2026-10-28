import type { ProductStockStatus } from '#shared/types/product'

/** Variante réduite à ce dont l'agrégation a besoin. */
interface StockVariant {
  isActive: boolean
  stockStatus: ProductStockStatus | null
}

/**
 * Agrégation du statut de stock au **niveau produit** (plan L98). Logique pure,
 * injectable (DI) : appelée dans le pipeline d'indexation
 * (`ProductIndexService.backfillDerivedColumns`), qui sert aussi de backfill des
 * fiches existantes.
 *
 * `products.stock_status` n'est **jamais** saisi : il est entièrement dérivé des
 * statuts des variantes **actives** de la fiche.
 */
export default class ProductStockService {
  /**
   * Statut de stock agrégé, sémantique « **priorité au disponible** » (seules les
   * variantes `isActive` comptent) :
   *
   * - `in_stock` si **au moins une** variante active est `in_stock` ;
   * - sinon `on_order` si au moins une variante active est `on_order` ;
   * - sinon `out_of_stock` si au moins une variante active est `out_of_stock` ;
   * - sinon `null` (aucune variante active ne porte de statut) → le produit
   *   n'apparaît sous aucune valeur de la facette « Stock ».
   */
  deriveStatus(variants: StockVariant[]): ProductStockStatus | null {
    const statuses = new Set(
      variants.filter((variant) => variant.isActive).map((variant) => variant.stockStatus)
    )
    if (statuses.has('in_stock')) return 'in_stock'
    if (statuses.has('on_order')) return 'on_order'
    if (statuses.has('out_of_stock')) return 'out_of_stock'
    return null
  }
}
