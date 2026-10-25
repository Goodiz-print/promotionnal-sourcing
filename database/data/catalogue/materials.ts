// GÉNÉRÉ depuis les classeurs Virgile (19 oct. 2026) — voir docs/changelog.
// Données de démonstration : régénérable, éditable à la main ensuite.

export interface MaterialSeed {
  slug: string
  label: string
  synonyms: string[]
}

/** Liste fermée « Matière ». `wood`/`plastic`/`cotton` préexistent (démo). */
export const MATERIALS: MaterialSeed[] = [
  {
    slug: 'plastic',
    label: 'Plastique',
    synonyms: [
      'plastic',
      'ABS',
      'PP',
      'polypropylene',
      'PS',
      'PET',
      'PC',
      'polycarbonate',
      'AS',
      'SAN',
      'acrylique',
      'PMMA',
    ],
  },
  {
    slug: 'recycled-plastic',
    label: 'Plastique recyclé (rPET, rABS, rPP)',
    synonyms: [
      'recycled plastic',
      'RPET',
      'rPET',
      'rABS',
      'rPP',
      'ocean plastic',
      'plastique recyclé',
    ],
  },
  {
    slug: 'bioplastic',
    label: 'Bioplastique / fibres végétales (PLA, paille de blé, fibre de bambou)',
    synonyms: [
      'PLA',
      'wheat straw',
      'paille de blé',
      'bamboo fibre',
      'bio-based',
      'biodegradable',
      'coffee grounds',
    ],
  },
  { slug: 'silicone', label: 'Silicone', synonyms: ['silicone', 'silicon'] },
  { slug: 'tritan', label: 'Tritan', synonyms: ['tritan', 'eastman tritan'] },
  { slug: 'aluminium', label: 'Aluminium', synonyms: ['aluminium', 'aluminum', 'alu'] },
  {
    slug: 'stainless-steel',
    label: 'Acier inoxydable',
    synonyms: ['stainless steel', 'inox', 'acier inoxydable', '304', '18/8', '316'],
  },
  {
    slug: 'metal',
    label: 'Métal (zinc, fer, laiton, acier)',
    synonyms: ['metal', 'zinc alloy', 'iron', 'brass', 'laiton', 'steel', 'acier', 'nickel'],
  },
  {
    slug: 'wood',
    label: 'Bois',
    synonyms: [
      'wood',
      'bois',
      'hêtre',
      'beech',
      'pin',
      'pine',
      'acacia',
      'chêne',
      'oak',
      'erable',
      'maple',
    ],
  },
  { slug: 'bamboo', label: 'Bambou', synonyms: ['bamboo', 'bambou'] },
  { slug: 'cork', label: 'Liège', synonyms: ['cork', 'liège'] },
  {
    slug: 'paper',
    label: 'Papier / Carton',
    synonyms: ['paper', 'papier', 'cardboard', 'carton', 'kraft', 'recycled paper'],
  },
  {
    slug: 'cotton',
    label: 'Coton',
    synonyms: ['cotton', 'coton', 'baumwolle', 'cotone', 'algodón'],
  },
  {
    slug: 'organic-cotton',
    label: 'Coton biologique',
    synonyms: ['organic cotton', 'coton bio', 'GOTS cotton'],
  },
  {
    slug: 'recycled-cotton',
    label: 'Coton recyclé',
    synonyms: ['recycled cotton', 'coton recyclé'],
  },
  {
    slug: 'polyester',
    label: 'Polyester',
    synonyms: ['polyester', 'poly', '600D', '210D', 'pongee', 'pongée'],
  },
  {
    slug: 'recycled-polyester',
    label: 'Polyester recyclé (RPET)',
    synonyms: ['RPET', 'recycled polyester', 'polyester recyclé'],
  },
  { slug: 'nylon', label: 'Nylon', synonyms: ['nylon', 'polyamide', 'PA'] },
  { slug: 'jute', label: 'Jute', synonyms: ['jute', 'toile de jute', 'burlap'] },
  { slug: 'canvas', label: 'Toile / Canvas', synonyms: ['canvas', 'toile', 'canvas cotton'] },
  {
    slug: 'non-woven',
    label: 'Non-tissé',
    synonyms: ['non-woven', 'non tissé', 'TNT', 'PP non-woven'],
  },
  { slug: 'felt', label: 'Feutre', synonyms: ['felt', 'feutre', 'RPET felt'] },
  {
    slug: 'wool',
    label: 'Laine / Acrylique',
    synonyms: ['wool', 'laine', 'acrylic', 'acrylique', 'merino'],
  },
  { slug: 'neoprene', label: 'Néoprène', synonyms: ['neoprene', 'néoprène'] },
  { slug: 'microfibre', label: 'Microfibre', synonyms: ['microfibre', 'microfiber'] },
  {
    slug: 'leather',
    label: 'Cuir',
    synonyms: ['leather', 'cuir', 'genuine leather', 'cuir véritable'],
  },
  {
    slug: 'faux-leather',
    label: 'Similicuir / PU',
    synonyms: ['PU', 'polyurethane', 'faux leather', 'similicuir', 'vegan leather', 'PU leather'],
  },
  {
    slug: 'glass',
    label: 'Verre',
    synonyms: ['glass', 'verre', 'borosilicate', 'glas', 'vetro', 'vidrio'],
  },
  {
    slug: 'ceramic',
    label: 'Céramique / Porcelaine',
    synonyms: [
      'ceramic',
      'céramique',
      'porcelain',
      'porcelaine',
      'stoneware',
      'grès',
      'bone china',
    ],
  },
  {
    slug: 'stone',
    label: 'Pierre / Ardoise / Marbre',
    synonyms: ['stone', 'slate', 'ardoise', 'marble', 'marbre'],
  },
  {
    slug: 'composite',
    label: 'Composite / Multi-matières',
    synonyms: ['mixed', 'multi-material', 'composite'],
  },
]
