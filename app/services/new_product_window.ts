import { DateTime } from 'luxon'
import { NEW_PRODUCT_WINDOW_DAYS } from '#shared/types/product'

/**
 * Seuil « Nouveautés » (écart 5) : début de la fenêtre récente
 * (`NEW_PRODUCT_WINDOW_DAYS` jours), ou `null` quand le filtre n'est pas demandé.
 * Factorisé ici — partagé par `ProductSearchService`, `ProductCatalogueService`
 * et les services de barres de facettes transverses (certifications, prix/MOQ) —
 * pour ne pas réécrire la même dérivation (CLAUDE.md interdit la duplication).
 */
export function newProductThreshold(newOnly: boolean): DateTime | null {
  return newOnly ? DateTime.now().minus({ days: NEW_PRODUCT_WINDOW_DAYS }).startOf('day') : null
}
