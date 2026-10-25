import type { ContentLocale } from './i18n.js'

/**
 * Nom de l'embedder Meilisearch. Les vecteurs sont **calculés par Meilisearch**
 * (embedder `rest` appelant l'API d'embeddings, `mistral-embed` par défaut —
 * ADR 0002, décision 3) à partir du champ `embeddingText` de chaque document :
 * l'application n'appelle jamais le provider, ni pour les fiches ni pour les
 * requêtes.
 */
export const SEARCH_EMBEDDER = 'default'

/**
 * Où tourne le modèle d'embeddings (ADR 0002, décision 3) :
 *
 * - `huggingface` (**défaut**) — Meilisearch télécharge un modèle open-weight et
 *   le fait tourner lui-même : aucune clé, aucun coût par token, les textes ne
 *   quittent pas l'infrastructure. Demande de la RAM et du CPU sur son instance ;
 * - `mistral` — API Mistral, appelée par Meilisearch (clé `MISTRAL_API_KEY`) ;
 * - `openai-compatible` — tout endpoint parlant le protocole OpenAI `/embeddings`
 *   (OpenAI, Together, Ollama, vLLM…).
 */
export const EMBEDDER_PROVIDERS = ['huggingface', 'mistral', 'openai-compatible'] as const

export type EmbedderProvider = (typeof EMBEDDER_PROVIDERS)[number]

export const DEFAULT_EMBEDDER_PROVIDER: EmbedderProvider = 'huggingface'

/**
 * Modèle `huggingface` par défaut : multilingue (100+ langues), 768 dimensions,
 * environ 1 Go. Choix de compromis entre qualité et ressources d'une instance
 * Docker ; `multilingual-e5-small` (384) est plus léger, `multilingual-e5-large`
 * (1024) plus précis. À trancher par `node ace search:evaluate` sur de vraies
 * fiches.
 */
export const DEFAULT_HUGGINGFACE_MODEL = 'intfloat/multilingual-e5-base'

/** Dimension demandée aux API d'embeddings (`mistral-embed` : 1024 natifs). */
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
  /**
   * Texte que Meilisearch vectorise (`documentTemplate` de l'embedder) : nom dans
   * la langue source, catégorie, facettes « attribut : valeur », début de la
   * description. Conçu pour la recherche, pas pour l'affichage (ADR 0002,
   * décision 4) ; toute modification de sa construction se répercute à la
   * prochaine synchronisation du produit, ou par `search:reindex`.
   */
  embeddingText: string
}

/** Résultat d'une synchronisation de produits vers l'index. */
export interface ProductSyncResult {
  indexed: number
  removed: number
}

/**
 * Filtres exacts d'une recherche. Chaque critère est un **pré-filtre booléen**
 * du moteur (ET) appliqué avant le classement — jamais de la pertinence. Les
 * facettes se combinent en ET : le produit doit porter **toutes** les valeurs.
 */
export interface ProductSearchFilter {
  categoryId?: number | null
  madeInEurope?: boolean
  attributeValueIds?: number[]
}

/** Requête envoyée au moteur (`SearchEngine#search`). */
export interface ProductSearchRequest {
  /** Mots-clés saisis par l'utilisateur (tolérance aux fautes côté moteur). */
  query: string
  /**
   * Poids du sémantique, de 0 à 1. À 0, recherche par mots-clés seuls : Meilisearch
   * n'appelle pas l'API d'embeddings. Au-dessus, il vectorise lui-même `query`.
   */
  semanticRatio: number
  filter: ProductSearchFilter
  /** Page demandée, à partir de 1. */
  page: number
  perPage: number
}

/** Réponse du moteur : identifiants ordonnés par pertinence et total. */
export interface ProductSearchHits {
  ids: number[]
  total: number
}

/**
 * Famille d'une requête de référence : ce qu'elle éprouve dans le pipeline.
 */
export const REFERENCE_QUERY_KINDS = [
  'keyword',
  'multilingual',
  'typo',
  'criteria',
  'semantic',
] as const

export type ReferenceQueryKind = (typeof REFERENCE_QUERY_KINDS)[number]

/**
 * Requête du jeu de référence (ADR 0002, décision 8) : une recherche, ses
 * filtres, et les fiches attendues sur le seed `full`.
 *
 * - `expected` : slugs attendus ;
 * - `exact` : le résultat doit être **exactement** `expected` (ET exact : ni
 *   plus, ni moins) — sinon seul le rappel compte ;
 * - `rank` : nombre de premiers résultats où les fiches attendues doivent
 *   figurer (10 par défaut). Une requête sémantique sur un petit jeu le resserre :
 *   sinon, dans les 10 premiers, tout le seed y figure et la requête ne prouve rien ;
 * - `requiresEmbeddings` : requête qui n'a de sens qu'avec des vecteurs
 *   (sémantique, synonymes) — ignorée tant que la vectorisation est désactivée.
 */
export interface ReferenceQuery {
  id: string
  kind: ReferenceQueryKind
  query: string
  /** Facettes demandées, par slug de valeur (`blue`), résolues en identifiants. */
  attributes?: string[]
  /** Catégorie demandée, par slug. */
  category?: string
  madeInEurope?: boolean
  expected: string[]
  exact?: boolean
  rank?: number
  requiresEmbeddings?: boolean
}

/** Résultat d'une requête du jeu de référence. */
export interface ReferenceQueryResult {
  id: string
  kind: ReferenceQueryKind
  query: string
  /** `skipped` : requête sémantique sans vecteurs disponibles. */
  status: 'passed' | 'failed' | 'skipped'
  /** Part des fiches attendues retrouvées dans les `rank` premières (10 par défaut). */
  recallAt10: number
  returned: string[]
  missing: string[]
  unexpected: string[]
  latencyMs: number
}

/** Rapport d'une évaluation du jeu de référence. */
export interface SearchEvaluationReport {
  results: ReferenceQueryResult[]
  /** Rappel@10 moyen sur les requêtes évaluées (hors ignorées). */
  recallAt10: number
  passed: number
  failed: number
  skipped: number
  latencyP50Ms: number
  latencyP95Ms: number
}
