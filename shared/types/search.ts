import type { ContentLocale } from './i18n.js'

/**
 * Nom de l'embedder Meilisearch. Les vecteurs sont **fournis par l'application**
 * (`userProvided`, calculés par `EmbeddingService` avec `mistral-embed`) :
 * Meilisearch ne fait que les stocker et les comparer.
 */
export const SEARCH_EMBEDDER = 'default'

/** Dimension des vecteurs, figée avec `products.embedding` (`halfvec(1024)`). */
export const SEARCH_EMBEDDING_DIMENSIONS = 1024

/**
 * Document d'un produit dans l'index de recherche.
 *
 * Seuls les produits **visibles** (actifs, organisation vivante, non rejetés)
 * sont indexés — mais l'index n'est qu'un moteur de rattrapage : à la lecture,
 * les produits retournés sont rechargés depuis PostgreSQL, qui reste juge de la
 * visibilité (cf. `docs/search.md`).
 */
export interface ProductSearchDocument {
  id: number
  slug: string
  reference: string | null
  categoryId: number
  supplierId: number
  madeInEurope: boolean
  originCountry: string | null
  /** Valeurs de facettes (`attribute_values.id`), pour le filtre ET exact. */
  attributeValueIds: number[]
  /** Nom par langue de contenu — `names.fr`, `names.en`… */
  names: Partial<Record<ContentLocale, string>>
  /** Description par langue de contenu. */
  descriptions: Partial<Record<ContentLocale, string>>
  /** Vecteur `mistral-embed`, absent tant que le produit n'est pas vectorisé. */
  _vectors: { [SEARCH_EMBEDDER]: number[] | null }
}

/** Résultat d'une synchronisation de produits vers l'index. */
export interface ProductSyncResult {
  indexed: number
  removed: number
}
