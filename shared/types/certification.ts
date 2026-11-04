import type { ContentLocale } from './i18n.js'

/**
 * Slug de l'attribut « Matière ». La dérivation « Éco-responsable » ne teste
 * `ECO_MATERIAL_SLUGS` que contre les valeurs de **cet** attribut : un slug
 * homonyme sous un autre attribut (finition, couleur…) ne doit pas marquer un
 * produit éco.
 */
export const MATERIAL_ATTRIBUTE_SLUG = 'material'

/**
 * Domaines d'un label de conformité (écart 4). Liste fermée, sert à regrouper
 * les certifications dans la fiche produit. Valeur **neutre** (slug) : son
 * libellé d'affichage est rendu côté UI via `t('certifications.domains.<slug>')`,
 * pas stocké en base (comme les autres enums).
 */
export const CERTIFICATION_DOMAINS = [
  'environment',
  'textile',
  'social',
  'safety',
  'food_contact',
  'forestry',
  'quality',
] as const

export type CertificationDomain = (typeof CERTIFICATION_DOMAINS)[number]

/**
 * Matières considérées **éco-responsables** (bio / recyclé / naturel renouvelable)
 * pour la dérivation du filtre « Éco-responsable » (`products.is_eco`). Ce sont
 * des slugs de valeurs de l'attribut `material` (cf. `database/data/catalogue/
 * materials.ts`). Un produit portant l'une de ces matières est éco, même sans
 * taux de recyclé ni label. Jamais saisi : la dérivation est faite par la
 * plateforme (`ProductEcoService`).
 */
export const ECO_MATERIAL_SLUGS = [
  'recycled-plastic',
  'bioplastic',
  'organic-cotton',
  'recycled-cotton',
  'recycled-polyester',
  'bamboo',
  'cork',
  'jute',
  'wood',
] as const

export type EcoMaterialSlug = (typeof ECO_MATERIAL_SLUGS)[number]

/**
 * Label de conformité sérialisé pour le frontend (`name` déjà résolu dans la
 * locale active par le transformer). Déclaré en `type` — contrainte props
 * Inertia `Record<string, JSONDataTypes>`.
 */
export type CertificationType = {
  id: number
  slug: string
  name: string | null
  domain: CertificationDomain
  /** Ce label atteste d'une démarche éco (alimente la dérivation `is_eco`). */
  isEco: boolean
}

/**
 * Label de conformité exposé à la **barre de filtres du catalogue** (ÉTAPE 6),
 * avec son **compteur** issu de la distribution de facettes du moteur
 * (`facetDistribution` sur `certificationIds`). `count` vaut `null` quand les
 * compteurs ne sont pas disponibles (moteur de recherche inerte ou injoignable) :
 * l'UI affiche alors le label sans badge. Déclaré en `type` (contrainte props
 * Inertia `Record<string, JSONDataTypes>`).
 */
export type CertificationFacetType = {
  id: number
  slug: string
  name: string | null
  domain: CertificationDomain
  count: number | null
}

/**
 * Barre de filtres **certifications** du catalogue (ÉTAPE 6). Transverse aux
 * catégories (contrairement aux attributs EAV) : disponible **sans catégorie
 * sélectionnée**, à côté de la barre dépendante de la catégorie. `hasCounts` est
 * `false` quand le moteur de recherche est indisponible (compteurs `null`).
 * Déclaré en `type` (contrainte props Inertia).
 */
export type CertificationFacetBarType = {
  certifications: CertificationFacetType[]
  hasCounts: boolean
}

/** Donnée de référence d'un label (seed) : libellé bilingue + synonymes d'import. */
export interface CertificationSeed {
  slug: string
  domain: CertificationDomain
  isEco: boolean
  names: Partial<Record<ContentLocale, string>>
  synonyms: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Administration des certifications (#165)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Certification dans la liste d'administration : nom résolu dans la locale
 * active, domaine, flag éco, nombre de produits qui la portent.
 */
export type CertificationAdminType = {
  id: number
  slug: string
  name: string | null
  domain: CertificationDomain
  isEco: boolean
  /** Nombre de produits rattachés (suppression refusée si > 0). */
  productsCount: number
}

/**
 * Certification exposée au formulaire d'édition : traductions par langue de
 * contenu (toutes), slug, domaine, isEco, synonymes et langue source.
 */
export type CertificationEditType = {
  id: number
  slug: string
  domain: CertificationDomain
  isEco: boolean
  synonyms: string[]
  sourceLocale: ContentLocale
  translations: Record<ContentLocale, { name: string; isAuto: boolean }>
}

/**
 * Création d'une certification (administration, #165). Le slug est figé
 * ensuite : les produits et URLs s'appuient dessus. Seule la traduction de
 * `sourceLocale` est requise, les autres langues sont générées.
 */
export interface CreateCertificationData {
  slug: string
  domain: CertificationDomain
  isEco: boolean
  synonyms?: string[]
  sourceLocale: ContentLocale
  translations: Partial<Record<ContentLocale, { name: string }>>
}

/**
 * Mise à jour partielle d'une certification. Le slug est figé.
 */
export interface UpdateCertificationData {
  domain?: CertificationDomain
  isEco?: boolean
  synonyms?: string[]
  sourceLocale?: ContentLocale
  translations?: Partial<Record<ContentLocale, { name?: string }>>
}
