// GÉNÉRÉ depuis les classeurs Virgile (19 oct. 2026) — voir docs/changelog.
// Données de démonstration : régénérable, éditable à la main ensuite.

export interface ColorFamilySeed {
  slug: string
  hex: string
  labels: { fr: string; en: string }
}

export interface ColorShadeSeed {
  slug: string
  hex: string
  familySlug: string
  synonyms: string[]
  label: string
}

/** 14 familles (N1). La valeur canonique = le slug. */
export const COLOR_FAMILIES: ColorFamilySeed[] = [
  { slug: 'black', hex: '#000000', labels: { fr: 'Noir', en: 'Black' } },
  { slug: 'white', hex: '#FFFFFF', labels: { fr: 'Blanc', en: 'White' } },
  { slug: 'grey', hex: '#8C8C8C', labels: { fr: 'Gris', en: 'Grey' } },
  { slug: 'blue', hex: '#1F5FBF', labels: { fr: 'Bleu', en: 'Blue' } },
  { slug: 'green', hex: '#2E8B57', labels: { fr: 'Vert', en: 'Green' } },
  { slug: 'red', hex: '#D62828', labels: { fr: 'Rouge', en: 'Red' } },
  { slug: 'pink', hex: '#E75480', labels: { fr: 'Rose', en: 'Pink' } },
  { slug: 'purple', hex: '#6A3FA0', labels: { fr: 'Violet', en: 'Purple' } },
  { slug: 'yellow', hex: '#F2C230', labels: { fr: 'Jaune', en: 'Yellow' } },
  { slug: 'orange', hex: '#F28C28', labels: { fr: 'Orange', en: 'Orange' } },
  { slug: 'brown', hex: '#7B4B2A', labels: { fr: 'Marron', en: 'Brown' } },
  { slug: 'beige', hex: '#D9C8A9', labels: { fr: 'Beige / Naturel', en: 'Beige' } },
  {
    slug: 'metal',
    hex: '#B8B8B8',
    labels: { fr: 'Métal (argent / or / inox)', en: 'Silver / Gold' },
  },
  {
    slug: 'transparent',
    hex: '#DDDDDD',
    labels: { fr: 'Transparent / Multicolore', en: 'Transparent / Multicolour' },
  },
]

/** 26 nuances (N2). `familySlug` rattache la nuance à sa famille (parent_value_id). */
export const COLOR_SHADES: ColorShadeSeed[] = [
  {
    slug: 'noir',
    hex: '#000000',
    familySlug: 'black',
    synonyms: ['black', 'noir', 'schwarz', 'nero', 'negro', 'jet black'],
    label: 'Noir',
  },
  {
    slug: 'blanc',
    hex: '#FFFFFF',
    familySlug: 'white',
    synonyms: ['white', 'blanc', 'weiss', 'bianco', 'blanco', 'off-white', 'écru'],
    label: 'Blanc',
  },
  {
    slug: 'gris-clair',
    hex: '#C8C8C8',
    familySlug: 'grey',
    synonyms: ['light grey', 'gris clair', 'silver grey', 'heather grey', 'gris chiné'],
    label: 'Gris clair',
  },
  {
    slug: 'gris-fonce-anthracite',
    hex: '#4A4A4A',
    familySlug: 'grey',
    synonyms: ['dark grey', 'anthracite', 'charcoal', 'graphite', 'titanium'],
    label: 'Gris foncé / Anthracite',
  },
  {
    slug: 'bleu-marine',
    hex: '#1B2A49',
    familySlug: 'blue',
    synonyms: ['navy', 'marine', 'dark blue', 'midnight blue'],
    label: 'Bleu marine',
  },
  {
    slug: 'bleu-royal',
    hex: '#1F4FBF',
    familySlug: 'blue',
    synonyms: ['royal blue', 'bleu roi', 'cobalt', 'blue'],
    label: 'Bleu royal',
  },
  {
    slug: 'bleu-ciel',
    hex: '#7FB6E6',
    familySlug: 'blue',
    synonyms: ['light blue', 'sky blue', 'bleu ciel', 'bleu clair', 'pastel blue'],
    label: 'Bleu ciel',
  },
  {
    slug: 'turquoise',
    hex: '#30B5B0',
    familySlug: 'blue',
    synonyms: ['turquoise', 'aqua', 'teal', 'bleu pétrole', 'petrol'],
    label: 'Turquoise',
  },
  {
    slug: 'vert-fonce',
    hex: '#1E5631',
    familySlug: 'green',
    synonyms: ['dark green', 'bottle green', 'forest green', 'vert bouteille', 'vert sapin'],
    label: 'Vert foncé',
  },
  {
    slug: 'vert',
    hex: '#2E8B57',
    familySlug: 'green',
    synonyms: ['green', 'vert', 'kelly green', 'grass green'],
    label: 'Vert',
  },
  {
    slug: 'vert-clair-lime',
    hex: '#9ACD32',
    familySlug: 'green',
    synonyms: ['lime', 'light green', 'apple green', 'vert pomme', 'vert anis', 'mint'],
    label: 'Vert clair / Lime',
  },
  {
    slug: 'rouge',
    hex: '#D62828',
    familySlug: 'red',
    synonyms: ['red', 'rouge', 'rot', 'rosso', 'rojo'],
    label: 'Rouge',
  },
  {
    slug: 'bordeaux',
    hex: '#6E1423',
    familySlug: 'red',
    synonyms: ['burgundy', 'bordeaux', 'wine', 'maroon', 'dark red'],
    label: 'Bordeaux',
  },
  {
    slug: 'rose',
    hex: '#F4A6C1',
    familySlug: 'pink',
    synonyms: ['pink', 'rose', 'light pink', 'pastel pink'],
    label: 'Rose',
  },
  {
    slug: 'fuchsia',
    hex: '#E0218A',
    familySlug: 'pink',
    synonyms: ['fuchsia', 'fucsia', 'magenta', 'hot pink', 'pink neon'],
    label: 'Fuchsia',
  },
  {
    slug: 'violet',
    hex: '#6A3FA0',
    familySlug: 'purple',
    synonyms: ['purple', 'violet', 'lilac', 'lavender', 'mauve'],
    label: 'Violet',
  },
  {
    slug: 'jaune',
    hex: '#F2C230',
    familySlug: 'yellow',
    synonyms: ['yellow', 'jaune', 'gelb', 'giallo', 'amarillo', 'neon yellow'],
    label: 'Jaune',
  },
  {
    slug: 'orange',
    hex: '#F28C28',
    familySlug: 'orange',
    synonyms: ['orange', 'neon orange', 'corail', 'coral'],
    label: 'Orange',
  },
  {
    slug: 'marron',
    hex: '#7B4B2A',
    familySlug: 'brown',
    synonyms: ['brown', 'marron', 'braun', 'chocolate', 'tan', 'cognac'],
    label: 'Marron',
  },
  {
    slug: 'beige-sable',
    hex: '#D9C8A9',
    familySlug: 'beige',
    synonyms: ['beige', 'sand', 'sable', 'cream', 'crème', 'ivory'],
    label: 'Beige / Sable',
  },
  {
    slug: 'kaki',
    hex: '#7A7A3A',
    familySlug: 'green',
    synonyms: ['khaki', 'kaki', 'olive', 'army green', 'military'],
    label: 'Kaki',
  },
  {
    slug: 'naturel-bois',
    hex: '#C9A86A',
    familySlug: 'beige',
    synonyms: [
      'natural',
      'naturel',
      'wood',
      'bois',
      'bambou',
      'bamboo',
      'kraft',
      'jute',
      'cork',
      'liège',
    ],
    label: 'Naturel / Bois',
  },
  {
    slug: 'argente-inox',
    hex: '#C0C0C0',
    familySlug: 'metal',
    synonyms: ['silver', 'argent', 'matt silver', 'stainless', 'inox', 'chrome', 'aluminium'],
    label: 'Argenté / Inox',
  },
  {
    slug: 'dore',
    hex: '#D4AF37',
    familySlug: 'metal',
    synonyms: ['gold', 'or', 'doré', 'champagne', 'rose gold', 'copper', 'cuivre'],
    label: 'Doré',
  },
  {
    slug: 'transparent',
    hex: '#EEEEEE',
    familySlug: 'transparent',
    synonyms: ['transparent', 'clear', 'frosted', 'givré', 'translucent'],
    label: 'Transparent',
  },
  {
    slug: 'multicolore',
    hex: '#CCCCCC',
    familySlug: 'transparent',
    synonyms: ['multicolour', 'multicolore', 'assorted', 'assortis', 'rainbow', 'mixed'],
    label: 'Multicolore',
  },
]
