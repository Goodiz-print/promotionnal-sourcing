import type { ReferenceQuery } from '#shared/types/search'

/**
 * Jeu de requêtes de référence (ADR 0002, décision 8), éprouvé sur le seed
 * `full` (`database/seeders/product_seeder.ts`). Il se rejoue à chaque changement
 * du pipeline de recherche — texte vectorisé, modèle d'embeddings, ratio
 * sémantique, quantification — par `node ace search:evaluate`.
 *
 * Chaque requête dit ce qu'elle éprouve (`kind`) et ce qu'elle doit renvoyer :
 *
 * - `exact` : le ET doit renvoyer **exactement** ces fiches, ni plus ni moins ;
 * - sans `exact` : les fiches attendues doivent figurer dans les 10 premières
 *   (rappel@10) ;
 * - `requiresEmbeddings` : sens seulement avec des vecteurs — ignorée tant que
 *   la vectorisation est désactivée.
 *
 * Le seed est bilingue FR/EN : les requêtes d'autres langues sont sémantiques
 * par nature. Étendre ce jeu avec de vraies fiches multilingues avant de
 * conclure sur le choix du modèle d'embeddings.
 */
export const REFERENCE_QUERIES: ReferenceQuery[] = [
  {
    id: 'kw-crayon',
    kind: 'keyword',
    query: 'crayon',
    expected: ['crayon-hb-bleu', 'crayon-aquarelle-bleu', 'crayon-hb-rouge'],
    exact: true,
  },
  {
    id: 'kw-stylo-bille',
    kind: 'keyword',
    query: 'stylo bille',
    expected: ['stylo-bille-bleu', 'stylo-bille-noir'],
    exact: true,
  },
  {
    id: 'kw-tote-bag',
    kind: 'keyword',
    query: 'tote bag',
    expected: ['sac-coton-bleu'],
    exact: true,
  },
  {
    // Une requête en anglais trouve des fiches saisies en français et en anglais :
    // le document porte les noms de toutes les langues dans un même attribut.
    id: 'multi-pencil-en',
    kind: 'multilingual',
    query: 'pencil',
    expected: ['crayon-hb-bleu', 'crayon-aquarelle-bleu', 'crayon-hb-rouge'],
    exact: true,
  },
  {
    id: 'typo-crayon',
    kind: 'typo',
    query: 'cryaon',
    expected: ['crayon-hb-bleu', 'crayon-aquarelle-bleu', 'crayon-hb-rouge'],
  },
  {
    id: 'typo-ballpoint',
    kind: 'typo',
    query: 'ballpoit pen',
    expected: ['stylo-bille-bleu', 'stylo-bille-noir'],
  },
  {
    // Le ET fiable : « crayon » ET « bleu » ne renvoie que les crayons bleus.
    id: 'et-crayon-bleu',
    kind: 'criteria',
    query: 'crayon',
    attributes: ['blue'],
    expected: ['crayon-hb-bleu', 'crayon-aquarelle-bleu'],
    exact: true,
  },
  {
    id: 'et-bleu-coton',
    kind: 'criteria',
    query: 'bleu',
    attributes: ['blue', 'cotton'],
    expected: ['sac-coton-bleu'],
    exact: true,
  },
  {
    id: 'et-bleu-stylo',
    kind: 'criteria',
    query: 'bleu',
    category: 'stylo',
    expected: ['stylo-bille-bleu'],
    exact: true,
  },
  {
    // Aucun crayon noir : le filtre ne laisse rien passer, même si le mot-clé existe.
    id: 'et-crayon-noir-vide',
    kind: 'criteria',
    query: 'crayon',
    attributes: ['black'],
    expected: [],
    exact: true,
  },
  {
    // Tous les instruments d'écriture (3 crayons, 2 stylos) devant le sac : sur un
    // seed de 6 fiches, c'est ce qui sépare le sémantique du hasard.
    id: 'sem-ecrire',
    kind: 'semantic',
    query: 'something to write with',
    expected: [
      'stylo-bille-bleu',
      'stylo-bille-noir',
      'crayon-hb-bleu',
      'crayon-aquarelle-bleu',
      'crayon-hb-rouge',
    ],
    rank: 5,
    requiresEmbeddings: true,
  },
  {
    id: 'sem-es-boligrafo-azul',
    kind: 'semantic',
    query: 'bolígrafo azul',
    expected: ['stylo-bille-bleu'],
    rank: 3,
    requiresEmbeddings: true,
  },
]
