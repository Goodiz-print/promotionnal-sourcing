import type { ReferenceQuery } from '#shared/types/search'

/**
 * Jeu de requêtes de référence (ADR 0002, décision 8), éprouvé sur le seed `full`
 * (`database/seeders/product_seeder.ts`). Il se rejoue à chaque changement du
 * pipeline de recherche — texte vectorisé, modèle d'embeddings, ratio sémantique,
 * quantification — par `node ace search:evaluate`.
 *
 * Chaque requête dit ce qu'elle éprouve (`kind`) et ce qu'elle doit renvoyer :
 *
 * - `rank: N` : les fiches attendues doivent occuper les `N` premières places. C'est
 *   la forme des requêtes par mots-clés : une recherche **hybride** complète
 *   toujours la liste avec les voisins sémantiques (sans seuil de pertinence), donc
 *   « exactement ces fiches » ne peut être exigé que de ce qui est filtré ;
 * - `exact` : le résultat doit être **exactement** `expected`. Réservé aux requêtes
 *   à filtres (catégorie, facettes) : un filtre est strict, il garantit le ET quoi
 *   que le sémantique ajoute — c'est la propriété que le produit promet ;
 * - `requiresEmbeddings` : sens seulement avec des vecteurs — ignorée tant que
 *   l'embedder est coupé.
 *
 * Le seed est bilingue FR/EN et compte six fiches : les requêtes d'autres langues
 * sont sémantiques par nature. Étendre ce jeu avec de vraies fiches multilingues
 * avant de conclure sur le choix du modèle d'embeddings.
 */
export const REFERENCE_QUERIES: ReferenceQuery[] = [
  {
    id: 'kw-crayon',
    kind: 'keyword',
    query: 'crayon',
    expected: ['crayon-hb-bleu', 'crayon-aquarelle-bleu', 'crayon-hb-rouge'],
    rank: 3,
  },
  {
    id: 'kw-stylo-bille',
    kind: 'keyword',
    query: 'stylo bille',
    expected: ['stylo-bille-bleu', 'stylo-bille-noir'],
    rank: 2,
  },
  {
    id: 'kw-tote-bag',
    kind: 'keyword',
    query: 'tote bag',
    expected: ['sac-coton-bleu'],
    rank: 1,
  },
  {
    // Une requête en anglais trouve des fiches saisies en français et en anglais :
    // le document porte les noms de toutes les langues dans un même attribut.
    id: 'multi-pencil-en',
    kind: 'multilingual',
    query: 'pencil',
    expected: ['crayon-hb-bleu', 'crayon-aquarelle-bleu', 'crayon-hb-rouge'],
    rank: 3,
  },
  {
    id: 'typo-crayon',
    kind: 'typo',
    query: 'cryaon',
    expected: ['crayon-hb-bleu', 'crayon-aquarelle-bleu', 'crayon-hb-rouge'],
    rank: 3,
  },
  {
    id: 'typo-ballpoint',
    kind: 'typo',
    query: 'ballpoit pen',
    expected: ['stylo-bille-bleu', 'stylo-bille-noir'],
    rank: 2,
  },
  {
    // Le ET fiable : catégorie « crayon » ET couleur « bleu » ne renvoie que les
    // crayons bleus — ni le stylo bleu, ni le sac bleu, quoi que le sémantique ajoute.
    id: 'et-crayon-bleu',
    kind: 'criteria',
    query: 'crayon',
    category: 'crayon',
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
    attributes: ['blue'],
    expected: ['stylo-bille-bleu'],
    exact: true,
  },
  {
    // Aucun crayon noir : le filtre ne laisse rien passer, même si le mot-clé existe
    // et que d'autres fiches noires existent (le stylo noir n'est pas un crayon).
    id: 'et-crayon-noir-vide',
    kind: 'criteria',
    query: 'crayon',
    category: 'crayon',
    attributes: ['black'],
    expected: [],
    exact: true,
  },
  {
    // Sans mot en commun avec les fiches : seul le sémantique peut les rapprocher.
    // Les deux stylos doivent précéder le reste.
    id: 'sem-ecrire',
    kind: 'semantic',
    query: 'something to write with',
    expected: ['stylo-bille-bleu', 'stylo-bille-noir'],
    rank: 2,
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
