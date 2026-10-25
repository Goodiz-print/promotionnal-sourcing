// GÉNÉRÉ depuis les classeurs Virgile (19 oct. 2026) — voir docs/changelog.
// Données de démonstration : régénérable, éditable à la main ensuite.

import type { CertificationSeed } from '#shared/types/certification'

/**
 * Liste fermée « Conformité produit » (écart 4) : labels au niveau produit avec
 * leur domaine et leurs synonymes d'import. `isEco` marque les labels
 * environnementaux qui alimentent la dérivation du filtre « Éco-responsable ».
 * Libellés bilingues FR/EN.
 */
export const CERTIFICATIONS: CertificationSeed[] = [
  {
    slug: 'gots',
    domain: 'textile',
    isEco: true,
    names: {
      fr: 'GOTS (Global Organic Textile Standard)',
      en: 'GOTS (Global Organic Textile Standard)',
    },
    synonyms: ['GOTS', 'organic textile', 'coton bio certifié'],
  },
  {
    slug: 'ocs',
    domain: 'textile',
    isEco: true,
    names: { fr: 'OCS (Organic Content Standard)', en: 'OCS (Organic Content Standard)' },
    synonyms: ['OCS', 'organic content'],
  },
  {
    slug: 'oeko-tex-standard-100',
    domain: 'textile',
    isEco: false,
    names: { fr: 'OEKO-TEX Standard 100', en: 'OEKO-TEX Standard 100' },
    synonyms: ['OEKO-TEX', 'oekotex', 'standard 100'],
  },
  {
    slug: 'bci',
    domain: 'textile',
    isEco: true,
    names: { fr: 'BCI (Better Cotton Initiative)', en: 'BCI (Better Cotton Initiative)' },
    synonyms: ['BCI', 'better cotton'],
  },
  {
    slug: 'bluesign',
    domain: 'textile',
    isEco: true,
    names: { fr: 'Bluesign', en: 'Bluesign' },
    synonyms: ['bluesign', 'blue sign'],
  },
  {
    slug: 'grs',
    domain: 'environment',
    isEco: true,
    names: { fr: 'GRS (Global Recycled Standard)', en: 'GRS (Global Recycled Standard)' },
    synonyms: ['GRS', 'global recycled standard', 'recyclé certifié'],
  },
  {
    slug: 'rcs',
    domain: 'environment',
    isEco: true,
    names: { fr: 'RCS (Recycled Claim Standard)', en: 'RCS (Recycled Claim Standard)' },
    synonyms: ['RCS', 'recycled claim'],
  },
  {
    slug: 'eu-ecolabel',
    domain: 'environment',
    isEco: true,
    names: { fr: 'Écolabel européen', en: 'EU Ecolabel' },
    synonyms: ['ecolabel', 'écolabel', 'EU flower'],
  },
  {
    slug: 'blauer-engel',
    domain: 'environment',
    isEco: true,
    names: { fr: 'Ange bleu (Blauer Engel)', en: 'Blue Angel (Blauer Engel)' },
    synonyms: ['blauer engel', 'blue angel', 'ange bleu'],
  },
  {
    slug: 'nordic-swan',
    domain: 'environment',
    isEco: true,
    names: { fr: 'Cygne nordique (Nordic Swan)', en: 'Nordic Swan Ecolabel' },
    synonyms: ['nordic swan', 'cygne nordique', 'svanen'],
  },
  {
    slug: 'cradle-to-cradle',
    domain: 'environment',
    isEco: true,
    names: { fr: 'Cradle to Cradle', en: 'Cradle to Cradle' },
    synonyms: ['cradle to cradle', 'C2C'],
  },
  {
    slug: 'iso-14001',
    domain: 'environment',
    isEco: true,
    names: {
      fr: 'ISO 14001 (management environnemental)',
      en: 'ISO 14001 (environmental management)',
    },
    synonyms: ['ISO 14001', 'iso14001'],
  },
  {
    slug: 'energy-star',
    domain: 'environment',
    isEco: true,
    names: { fr: 'Energy Star', en: 'Energy Star' },
    synonyms: ['energy star', 'energystar'],
  },
  {
    slug: 'tco-certified',
    domain: 'environment',
    isEco: true,
    names: { fr: 'TCO Certified', en: 'TCO Certified' },
    synonyms: ['TCO', 'tco certified'],
  },
  {
    slug: 'fsc',
    domain: 'forestry',
    isEco: true,
    names: { fr: 'FSC (Forest Stewardship Council)', en: 'FSC (Forest Stewardship Council)' },
    synonyms: ['FSC', 'forest stewardship'],
  },
  {
    slug: 'pefc',
    domain: 'forestry',
    isEco: true,
    names: { fr: 'PEFC', en: 'PEFC' },
    synonyms: ['PEFC', 'bois certifié'],
  },
  {
    slug: 'fairtrade',
    domain: 'social',
    isEco: false,
    names: { fr: 'Fairtrade / Commerce équitable', en: 'Fairtrade' },
    synonyms: ['fairtrade', 'commerce équitable', 'max havelaar'],
  },
  {
    slug: 'sa8000',
    domain: 'social',
    isEco: false,
    names: { fr: 'SA8000', en: 'SA8000' },
    synonyms: ['SA8000', 'sa 8000'],
  },
  {
    slug: 'amfori-bsci',
    domain: 'social',
    isEco: false,
    names: { fr: 'amfori BSCI', en: 'amfori BSCI' },
    synonyms: ['BSCI', 'amfori', 'amfori bsci'],
  },
  {
    slug: 'sedex-smeta',
    domain: 'social',
    isEco: false,
    names: { fr: 'Sedex / SMETA', en: 'Sedex / SMETA' },
    synonyms: ['sedex', 'smeta'],
  },
  {
    slug: 'wrap',
    domain: 'social',
    isEco: false,
    names: { fr: 'WRAP', en: 'WRAP' },
    synonyms: ['WRAP', 'worldwide responsible accredited production'],
  },
  {
    slug: 'fair-wear',
    domain: 'social',
    isEco: false,
    names: { fr: 'Fair Wear Foundation', en: 'Fair Wear Foundation' },
    synonyms: ['fair wear', 'fairwear'],
  },
  {
    slug: 'ce',
    domain: 'safety',
    isEco: false,
    names: { fr: 'Marquage CE', en: 'CE marking' },
    synonyms: ['CE', 'marquage CE', 'ce marking'],
  },
  {
    slug: 'rohs',
    domain: 'safety',
    isEco: false,
    names: { fr: 'RoHS', en: 'RoHS' },
    synonyms: ['RoHS', 'rohs'],
  },
  {
    slug: 'reach',
    domain: 'safety',
    isEco: false,
    names: { fr: 'REACH', en: 'REACH' },
    synonyms: ['REACH', 'reach'],
  },
  {
    slug: 'en71',
    domain: 'safety',
    isEco: false,
    names: { fr: 'EN 71 (sécurité des jouets)', en: 'EN 71 (toy safety)' },
    synonyms: ['EN71', 'en 71', 'toy safety'],
  },
  {
    slug: 'prop-65',
    domain: 'safety',
    isEco: false,
    names: { fr: 'California Prop 65', en: 'California Prop 65' },
    synonyms: ['prop 65', 'proposition 65'],
  },
  {
    slug: 'lfgb',
    domain: 'food_contact',
    isEco: false,
    names: { fr: 'LFGB (contact alimentaire)', en: 'LFGB (food contact)' },
    synonyms: ['LFGB', 'contact alimentaire'],
  },
  {
    slug: 'fda',
    domain: 'food_contact',
    isEco: false,
    names: { fr: 'FDA (contact alimentaire)', en: 'FDA (food contact)' },
    synonyms: ['FDA', 'food contact'],
  },
  {
    slug: 'iso-9001',
    domain: 'quality',
    isEco: false,
    names: { fr: 'ISO 9001 (management de la qualité)', en: 'ISO 9001 (quality management)' },
    synonyms: ['ISO 9001', 'iso9001'],
  },
]
