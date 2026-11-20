// GÉNÉRÉ depuis les classeurs Virgile (19 oct. 2026) — voir docs/changelog.
// Données de démonstration : régénérable, éditable à la main ensuite.

import type { MarkingTechniqueSeed } from '#shared/types/marking'

/**
 * Liste fermée « Technique de marquage » (écart 2) : ~18 procédés canoniques
 * avec leur famille et leurs synonymes d'import (dictionnaire de libellés
 * fournisseurs). La technique de marquage n'est **pas** un filtre (donnée de
 * fiche) — pas de facette Meilisearch. Libellés bilingues FR/EN.
 */
export const MARKING_TECHNIQUES: MarkingTechniqueSeed[] = [
  {
    slug: 'pad-printing',
    family: 'print',
    names: { fr: 'Tampographie', en: 'Pad printing' },
    synonyms: ['tampographie', 'pad printing', 'tampo', 'tampondruck', 'tampografia'],
  },
  {
    slug: 'screen-printing',
    family: 'print',
    names: { fr: 'Sérigraphie', en: 'Screen printing' },
    synonyms: ['sérigraphie', 'screen printing', 'silk screen', 'siebdruck', 'serigrafia'],
  },
  {
    slug: 'digital-printing',
    family: 'print',
    names: { fr: 'Impression numérique', en: 'Digital printing' },
    synonyms: ['impression numérique', 'digital print', 'inkjet', 'digital', 'digitalw2'],
  },
  {
    slug: 'uv-printing',
    family: 'print',
    names: { fr: 'Impression UV', en: 'UV printing' },
    synonyms: ['impression uv', 'uv print', 'uv led', 'digital uv'],
  },
  {
    slug: 'offset-printing',
    family: 'print',
    names: { fr: 'Offset', en: 'Offset printing' },
    synonyms: ['offset', 'litho', 'lithographie'],
  },
  {
    slug: 'transfer',
    family: 'transfer',
    names: { fr: 'Transfert', en: 'Transfer' },
    synonyms: ['transfert', 'transfer', 'heat transfer', 'flex'],
  },
  {
    slug: 'digital-transfer',
    family: 'transfer',
    names: { fr: 'Transfert numérique', en: 'Digital transfer' },
    synonyms: ['transfert numérique', 'digital transfer', 'full colour transfer'],
  },
  {
    slug: 'sublimation',
    family: 'transfer',
    names: { fr: 'Sublimation', en: 'Sublimation' },
    synonyms: ['sublimation', 'dye sublimation', 'all-over print', 'sublimacion'],
  },
  {
    slug: 'dtf',
    family: 'transfer',
    names: { fr: 'DTF (transfert direct sur film)', en: 'DTF (direct-to-film)' },
    synonyms: ['dtf', 'direct to film', 'direct-to-film', 'dtf1', 'dtf2', 'dtf3'],
  },
  {
    slug: 'laser-engraving',
    family: 'engraving',
    names: { fr: 'Gravure laser', en: 'Laser engraving' },
    synonyms: ['gravure laser', 'laser engraving', 'laser', 'lasergravur'],
  },
  {
    slug: 'mechanical-engraving',
    family: 'engraving',
    names: { fr: 'Gravure mécanique', en: 'Mechanical engraving' },
    synonyms: [
      'gravure mécanique',
      'mechanical engraving',
      'rotary engraving',
      'diamond engraving',
    ],
  },
  {
    slug: 'embroidery',
    family: 'embroidery',
    names: { fr: 'Broderie', en: 'Embroidery' },
    synonyms: ['broderie', 'embroidery', 'stickerei'],
  },
  {
    slug: 'woven-badge',
    family: 'embroidery',
    names: { fr: 'Écusson tissé', en: 'Woven badge' },
    synonyms: ['écusson tissé', 'woven badge', 'woven label', 'patch tissé'],
  },
  {
    slug: 'embossing',
    family: 'relief',
    names: { fr: 'Gaufrage (relief)', en: 'Embossing' },
    synonyms: ['gaufrage', 'embossing', 'relief', 'prägung'],
  },
  {
    slug: 'debossing',
    family: 'relief',
    names: { fr: 'Marquage en creux', en: 'Debossing' },
    synonyms: ['marquage en creux', 'debossing', 'estampage creux'],
  },
  {
    slug: 'doming',
    family: 'special',
    names: { fr: 'Doming (résine)', en: 'Doming' },
    synonyms: ['doming', 'résine', 'resin', 'epoxy dome', '3d sticker'],
  },
  {
    slug: 'hot-stamping',
    family: 'special',
    names: { fr: 'Dorure à chaud', en: 'Hot stamping' },
    synonyms: ['dorure à chaud', 'hot stamping', 'foil', 'marquage à chaud', 'heißprägung'],
  },
  {
    slug: 'in-mould-labelling',
    family: 'special',
    names: { fr: 'Étiquetage dans le moule (IML)', en: 'In-mould labelling (IML)' },
    synonyms: ['iml', 'in-mould labelling', 'in mold label', 'étiquetage moule'],
  },
]
