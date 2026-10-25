// Attributs propres à quelques catégories + leur rattachement (pivot
// category_attributes) et tranches (category_attribute_ranges), tirés des
// classeurs Virgile (onglets « Champs par catégorie » / « Filtres par
// catégorie »). Jeu CURÉ et représentatif (Écriture>Stylos, Boissons>Gourdes,
// Casquettes>Casquettes) : il valide la résolution héritée, les tranches et la
// garde de publication. Le reste des ~300 lignes du classeur s'ajoute ici au
// fil de la validation de Virgile, sans changement de schéma.

export type FacetAttributeType = 'enum' | 'number' | 'boolean' | 'string'

export interface FacetValueSeed {
  slug: string
  value: string
  label: string
}

/** Définition d'un attribut propre à une catégorie (hors couleur/matière). */
export interface FacetAttributeSeed {
  slug: string
  type: FacetAttributeType
  /** Nom FR (langue source) ; l'EN retombe sur le FR tant qu'il n'est pas saisi. */
  name: string
  unit?: string | null
  values?: FacetValueSeed[]
}

export interface RangeSeed {
  minValue: number | null
  maxValue: number | null
}

/** Une ligne du pivot category_attributes, par slugs. */
export interface CategoryAttributeLinkSeed {
  categorySlug: string
  attributeSlug: string
  isRequiredForPublication?: boolean
  isFilter?: boolean
  position: number
  /** Tranches de filtre (attributs numériques) ; libellé rendu côté UI. */
  ranges?: RangeSeed[]
}

/** Attributs propres aux catégories curées. */
export const FACET_ATTRIBUTES: FacetAttributeSeed[] = [
  {
    slug: 'ink-type',
    type: 'enum',
    name: "Type d'encre",
    values: [
      { slug: 'ballpoint', value: 'ballpoint', label: 'Bille' },
      { slug: 'rollerball', value: 'rollerball', label: 'Roller' },
      { slug: 'gel', value: 'gel', label: 'Gel' },
      { slug: 'felt-tip', value: 'felt-tip', label: 'Feutre' },
      {
        slug: 'multifunction',
        value: 'multifunction',
        label: 'Multifonction (stylo + stylet + crayon)',
      },
    ],
  },
  {
    slug: 'ink-color',
    type: 'enum',
    name: "Couleur d'encre",
    values: [
      // Valeurs préfixées `ink-*` : la couleur d'encre est un attribut distinct
      // de la couleur de l'objet (`color`), qui garde les valeurs blue/red/…
      { slug: 'ink-black', value: 'ink-black', label: 'Noire' },
      { slug: 'ink-blue', value: 'ink-blue', label: 'Bleue' },
      { slug: 'ink-red', value: 'ink-red', label: 'Rouge' },
      { slug: 'ink-green', value: 'ink-green', label: 'Verte' },
      { slug: 'ink-multicolor', value: 'ink-multicolor', label: 'Multicolore (4 couleurs)' },
    ],
  },
  {
    slug: 'pen-mechanism',
    type: 'enum',
    name: 'Mécanisme',
    values: [
      { slug: 'click', value: 'click', label: 'Poussoir (clic)' },
      { slug: 'twist', value: 'twist', label: 'Rotation (twist)' },
      { slug: 'cap', value: 'cap', label: 'Capuchon' },
    ],
  },
  { slug: 'touch-stylus', type: 'boolean', name: 'Stylet tactile' },
  { slug: 'bottle-capacity', type: 'number', name: 'Contenance', unit: 'ml' },
  { slug: 'insulated', type: 'boolean', name: 'Isotherme (double paroi)' },
  {
    slug: 'bottle-cap',
    type: 'enum',
    name: 'Type de bouchon',
    values: [
      { slug: 'screw', value: 'screw', label: 'À vis' },
      { slug: 'sport', value: 'sport', label: 'Sport (pop-up)' },
      { slug: 'straw', value: 'straw', label: 'Paille' },
      { slug: 'infuser', value: 'infuser', label: 'Infuseur' },
      { slug: 'flip', value: 'flip', label: 'Flip' },
      { slug: 'carabiner', value: 'carabiner', label: 'Mousqueton' },
    ],
  },
  {
    slug: 'cap-panels',
    type: 'enum',
    name: 'Nombre de panneaux',
    values: [
      { slug: '5', value: '5', label: '5' },
      { slug: '6', value: '6', label: '6' },
      { slug: '7', value: '7', label: '7' },
    ],
  },
  {
    slug: 'cap-type',
    type: 'enum',
    name: 'Type de casquette',
    values: [
      { slug: 'baseball', value: 'baseball', label: 'Casquette baseball' },
      { slug: 'trucker', value: 'trucker', label: 'Trucker (mesh)' },
      { slug: 'dad-cap', value: 'dad-cap', label: 'Dad cap' },
      { slug: 'visor', value: 'visor', label: 'Visière' },
      { slug: 'flat-cap', value: 'flat-cap', label: 'Casquette plate' },
      { slug: 'kids-cap', value: 'kids-cap', label: 'Casquette enfant' },
    ],
  },
  {
    slug: 'cap-closure',
    type: 'enum',
    name: 'Fermeture',
    values: [
      { slug: 'velcro', value: 'velcro', label: 'Scratch (velcro)' },
      { slug: 'metal-buckle', value: 'metal-buckle', label: 'Boucle métal' },
      { slug: 'snapback', value: 'snapback', label: 'Snapback plastique' },
      { slug: 'elastic', value: 'elastic', label: 'Ajustée / élastique' },
      { slug: 'cord', value: 'cord', label: 'Cordon' },
    ],
  },
  { slug: 'cap-weight', type: 'number', name: 'Grammage', unit: 'g/m²' },
]

/**
 * Rattachements. Les facettes transverses (`color` famille, `color-shade`,
 * `material`) sont attachées au **N1** : elles sont héritées par toutes les
 * sous-catégories (preuve de la résolution par ancêtres). Les attributs propres
 * sont au **N2**. Les `position` basses (1-3) placent les filtres communs avant
 * les filtres spécifiques (10+), comme dans le classeur.
 */
export const CATEGORY_ATTRIBUTE_LINKS: CategoryAttributeLinkSeed[] = [
  // Écriture (N1) : couleur + matière, héritées par les stylos.
  { categorySlug: 'ecriture', attributeSlug: 'color', isFilter: true, position: 1 },
  { categorySlug: 'ecriture', attributeSlug: 'material', isFilter: true, position: 2 },
  // Écriture > Stylos (N2).
  {
    categorySlug: 'ecriture-stylos-bille-roller-gel',
    attributeSlug: 'ink-type',
    isRequiredForPublication: true,
    isFilter: true,
    position: 10,
  },
  {
    categorySlug: 'ecriture-stylos-bille-roller-gel',
    attributeSlug: 'ink-color',
    isRequiredForPublication: true,
    isFilter: true,
    position: 11,
  },
  {
    categorySlug: 'ecriture-stylos-bille-roller-gel',
    attributeSlug: 'pen-mechanism',
    isFilter: true,
    position: 12,
  },
  {
    categorySlug: 'ecriture-stylos-bille-roller-gel',
    attributeSlug: 'touch-stylus',
    isFilter: true,
    position: 13,
  },

  // Boissons (N1) : couleur + matière.
  { categorySlug: 'boissons', attributeSlug: 'color', isFilter: true, position: 1 },
  { categorySlug: 'boissons', attributeSlug: 'material', isFilter: true, position: 2 },
  // Boissons > Gourdes (N2) : contenance en tranches (libellé non stocké).
  {
    categorySlug: 'boissons-gourdes-et-bouteilles',
    attributeSlug: 'bottle-capacity',
    isRequiredForPublication: true,
    isFilter: true,
    position: 10,
    ranges: [
      { minValue: null, maxValue: 400 },
      { minValue: 400, maxValue: 600 },
      { minValue: 600, maxValue: 900 },
      { minValue: 900, maxValue: null },
    ],
  },
  {
    categorySlug: 'boissons-gourdes-et-bouteilles',
    attributeSlug: 'insulated',
    isFilter: true,
    position: 11,
  },
  {
    categorySlug: 'boissons-gourdes-et-bouteilles',
    attributeSlug: 'bottle-cap',
    isFilter: true,
    position: 12,
  },

  // Casquettes & chapeaux (N1) : couleur famille + nuance + matière.
  { categorySlug: 'casquettes-chapeaux', attributeSlug: 'color', isFilter: true, position: 1 },
  { categorySlug: 'casquettes-chapeaux', attributeSlug: 'material', isFilter: true, position: 2 },
  {
    categorySlug: 'casquettes-chapeaux',
    attributeSlug: 'color-shade',
    isFilter: true,
    position: 3,
  },
  // Casquettes > Casquettes (N2).
  {
    categorySlug: 'casquettes-chapeaux-casquettes',
    attributeSlug: 'cap-panels',
    isRequiredForPublication: true,
    isFilter: true,
    position: 10,
  },
  {
    categorySlug: 'casquettes-chapeaux-casquettes',
    attributeSlug: 'cap-type',
    isRequiredForPublication: true,
    isFilter: true,
    position: 11,
  },
  {
    categorySlug: 'casquettes-chapeaux-casquettes',
    attributeSlug: 'cap-closure',
    isFilter: true,
    position: 12,
  },
  {
    categorySlug: 'casquettes-chapeaux-casquettes',
    attributeSlug: 'cap-weight',
    isFilter: true,
    position: 13,
    ranges: [
      { minValue: null, maxValue: 200 },
      { minValue: 200, maxValue: 280 },
      { minValue: 280, maxValue: null },
    ],
  },
]
