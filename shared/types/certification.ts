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

/** Donnée de référence d'un label (seed) : libellé bilingue + synonymes d'import. */
export interface CertificationSeed {
  slug: string
  domain: CertificationDomain
  isEco: boolean
  names: Partial<Record<ContentLocale, string>>
  synonyms: string[]
}
