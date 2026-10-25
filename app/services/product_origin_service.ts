import { isEuEeaCountry, isKnownCountry } from '#shared/types/country'
import type { OriginZone } from '#shared/types/product'

/**
 * Dérivation de la **zone de provenance** d'un produit (écart 9, filtre à 3
 * états). Logique pure, injectable (DI) : appelée au save produit
 * (`SupplierProductService`) et dans le pipeline d'indexation
 * (`ProductIndexService`), qui sert aussi de backfill des fiches existantes.
 *
 * `origin_zone` n'est **jamais** saisie à la main : elle est entièrement
 * calculée à partir de `originCountry` (code ISO alpha-2) et du drapeau
 * `madeInEurope`.
 */
export default class ProductOriginService {
  /**
   * Zone de provenance dérivée :
   *
   * - `france` si le pays est `FR` ;
   * - `europe` si le pays est dans l'UE/EEE, **ou** si `madeInEurope` est vrai
   *   (le fournisseur déclare une fabrication européenne sans préciser le pays) ;
   * - `other` si le pays est connu mais hors Europe ;
   * - `null` si l'origine est **inconnue** (pays absent/inconnu et pas de drapeau
   *   `madeInEurope`) : la fiche est alors exclue des cases France/Europe.
   */
  deriveZone(originCountry: string | null | undefined, madeInEurope: boolean): OriginZone | null {
    const country = originCountry?.trim().toUpperCase() || null

    if (country === 'FR') return 'france'
    if (country && isEuEeaCountry(country)) return 'europe'
    if (madeInEurope) return 'europe'
    if (country && isKnownCountry(country)) return 'other'
    return null
  }
}
