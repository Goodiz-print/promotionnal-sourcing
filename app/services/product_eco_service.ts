import { ECO_MATERIAL_SLUGS } from '#shared/types/certification'

/** Entrées de la dérivation « Éco-responsable » d'un produit (écart 4). */
export interface EcoDerivationInput {
  /** Part de matière recyclée saisie (0-100), ou `null`. */
  recycledContentPercent: number | null
  /** Slugs des valeurs de matière (`material`) portées par le produit. */
  materialSlugs: string[]
  /** Le produit porte-t-il au moins un label de conformité éco (`is_eco`) ? */
  hasEcoCertification: boolean
}

/**
 * Dérivation du filtre **« Éco-responsable »** d'un produit (`products.is_eco`,
 * écart 4). Logique pure, injectable (DI) : appelée au save produit
 * (`SupplierProductService`), dans le pipeline d'indexation
 * (`ProductIndexService`, qui sert aussi de backfill) et au seeding.
 *
 * `is_eco` n'est **jamais** saisi : il est entièrement calculé par la
 * plateforme. Un produit est éco-responsable si **l'un** des critères est vrai :
 *
 * - il déclare une part de matière recyclée (`recycled_content_percent > 0`) ;
 * - il porte une matière bio / recyclée / naturelle renouvelable
 *   (`ECO_MATERIAL_SLUGS`) ;
 * - il porte au moins un **label éco** (`certifications.is_eco`).
 */
export default class ProductEcoService {
  private static readonly ECO_MATERIALS = new Set<string>(ECO_MATERIAL_SLUGS)

  deriveIsEco(input: EcoDerivationInput): boolean {
    if ((input.recycledContentPercent ?? 0) > 0) return true
    if (input.materialSlugs.some((slug) => ProductEcoService.ECO_MATERIALS.has(slug))) return true
    if (input.hasEcoCertification) return true
    return false
  }
}
