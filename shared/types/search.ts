/**
 * Resultat de la recherche hybride catalogue (full-text + vectoriel).
 * `score` est un score de fusion (Reciprocal Rank Fusion), pas une mesure
 * absolue comparable entre deux appels.
 */
export interface ProductSearchResult {
  productId: number
  score: number
}
