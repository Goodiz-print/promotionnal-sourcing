import type { ContentLocale } from './i18n.js'

/**
 * Technique de marquage (écart 2) sérialisée pour le frontend. Référentiel fermé
 * (~18 canoniques) ; `name` est déjà résolu dans la locale active par le
 * transformer. La technique n'est **pas** un filtre (donnée de fiche) — pas de
 * facette Meilisearch. Déclaré en `type` — contrainte props Inertia.
 */
export type MarkingTechniqueType = {
  id: number
  slug: string
  name: string | null
  /** Famille de procédé (impression, transfert, gravure, broderie…). */
  family: string
}

/** Donnée de référence d'une technique (seed) : libellé bilingue + synonymes d'import. */
export interface MarkingTechniqueSeed {
  slug: string
  family: string
  names: Partial<Record<ContentLocale, string>>
  synonyms: string[]
}

/**
 * Technique possible sur une position de marquage (écart 2), résolue dans la
 * locale active : libellé de technique + nombre de couleurs max + frais
 * techniques (setup, décimal sérialisé en chaîne par Lucid).
 */
export type ProductMarkingPositionTechniqueType = {
  id: number
  markingTechniqueId: number
  techniqueSlug: string
  techniqueName: string | null
  techniqueFamily: string
  maxColors: number | null
  defaultSetupCharge: string | null
}

/**
 * Zone de marquage d'un produit (écart 2) : nom, dimensions max imprimables,
 * gabarit (document du produit de type `marking_template`) et techniques
 * possibles. `position` donne l'ordre d'affichage.
 */
export type ProductMarkingPositionType = {
  id: number
  name: string
  maxWidthMm: number | null
  maxHeightMm: number | null
  templateDocumentId: number | null
  position: number
  techniques: ProductMarkingPositionTechniqueType[]
}

/**
 * Palier de la grille de prix de marquage (écart 2) : à partir de `minQuantity`
 * pièces, le marquage dans cette technique coûte `unitPrice` par pièce. Décimal
 * sérialisé en chaîne par Lucid. Technique résolue dans la locale active.
 */
export type ProductMarkingPriceTierType = {
  id: number
  markingTechniqueId: number
  techniqueSlug: string
  techniqueName: string | null
  minQuantity: number
  unitPrice: string
  currency: string
}

/**
 * Technique saisie sur une position (écart 2). `markingTechniqueId` doit
 * référencer une technique existante (contrôlé par le service).
 */
export interface ProductMarkingPositionTechniqueInput {
  markingTechniqueId: number
  maxColors?: number | null
  defaultSetupCharge?: number | null
}

/**
 * Position de marquage saisie (écart 2). `templateDocumentId` doit pointer un
 * document du produit de type `marking_template` (contrôlé par le service).
 * L'ordre du tableau donne la `position`.
 */
export interface ProductMarkingPositionInput {
  name: string
  maxWidthMm?: number | null
  maxHeightMm?: number | null
  templateDocumentId?: number | null
  techniques?: ProductMarkingPositionTechniqueInput[]
}

/**
 * Palier de prix de marquage saisi (écart 2). `markingTechniqueId` doit
 * référencer une technique existante ; la devise est reprise du produit.
 */
export interface ProductMarkingPriceTierInput {
  markingTechniqueId: number
  minQuantity: number
  unitPrice: number
}
