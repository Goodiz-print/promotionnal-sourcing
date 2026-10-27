import type { ContentLocale } from './i18n.js'
import type { OriginZone } from './product.js'

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
  /**
   * Zone de provenance dérivée (écart 9) pour le filtre à 3 états. `null` =
   * origine inconnue, exclue des cases France/Europe.
   */
  originZone: OriginZone | null
  /**
   * Date de sortie en **timestamp Unix (secondes)** pour le filtre « Nouveautés »
   * (écart 5), ou `null`. Un nombre permet le filtre d'intervalle Meilisearch
   * (`releasedAt >= <seuil>`).
   */
  releasedAt: number | null
  /**
   * Filtre dérivé « Éco-responsable » (écart 4) : `true` si le produit déclare
   * du recyclé, porte une matière éco ou un label éco. Calculé par la plateforme
   * (`ProductEcoService`), jamais saisi.
   */
  isEco: boolean
  /** Valeurs de facettes (`attribute_values.id`), pour le filtre ET exact. */
  attributeValueIds: number[]
  /**
   * Identifiants des labels de conformité du produit (`certifications.id`, écart 4)
   * — facette **transverse aux catégories** (ÉTAPE 6). Filtre ET exact comme
   * `attributeValueIds` : `certificationIds = X AND certificationIds = Y` exige
   * **tous** les labels cochés. Donnée directe (pivot `product_certifications`),
   * jamais dérivée : `search:reindex` suffit à peupler la facette.
   */
  certificationIds: number[]
  /**
   * Facettes **aplaties par slug d'attribut** (`attributes.color`,
   * `attributes.color-shade`, `attributes.material`…) : chaque clé porte la ou
   * les valeurs de facette du produit pour cet attribut. Les attributs énumérés
   * (couleur famille N1, nuance N2, matière…) portent les **identifiants** de
   * valeur (`attribute_values.id`), les attributs numériques la **valeur brute**.
   *
   * Complète `attributeValueIds` (qui mélange toutes les valeurs sans distinction
   * d'attribut et sert le filtre ET) : la forme aplatie donne les **distributions
   * de facettes** par attribut (compteurs par valeur, `facetDistribution`) et
   * pilote la barre de filtres dépendante de la catégorie. La couleur **famille**
   * (N1) est émise sous `attributes.color` même quand le produit ne porte qu'une
   * **nuance** (N2) : elle est dérivée du `parent_value_id` de la nuance.
   */
  attributes: Record<string, number[]>
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
  /**
   * Labels de conformité (écart 4, ÉTAPE 6) : filtre **ET exact** comme
   * `attributeValueIds` — le produit doit porter **tous** les labels cochés.
   * Vide/absent = pas de filtre certifications.
   */
  certificationIds?: number[]
  /**
   * Provenance à 3 états (écart 9) : les zones demandées se combinent en **OU**
   * (France OU Europe), car les cases ne s'excluent pas. Vide/absent = pas de
   * filtre de provenance.
   */
  originZones?: OriginZone[]
  /**
   * Seuil « Nouveautés » (écart 5) en timestamp Unix (secondes) : ne garde que
   * les produits dont `releasedAt >= releasedAfter`.
   */
  releasedAfter?: number | null
  /**
   * Filtre « Éco-responsable » (écart 4) : `true` ne garde que les produits
   * `is_eco`. Absent/`false` = pas de filtre éco.
   */
  isEco?: boolean
}

/**
 * Préfixe des champs de facette **aplatis par slug** dans l'index : l'attribut
 * de slug `color` est indexé sous le champ `attributes.color`. C'est ce champ
 * qu'on déclare `filterableAttributes` (dérivés de `category_attributes.is_filter`)
 * et qu'on demande en `facets` pour obtenir ses distributions.
 */
export const FACET_FIELD_PREFIX = 'attributes'

/** Champ d'index d'une facette aplatie, depuis le slug de l'attribut. */
export function facetField(slug: string): string {
  return `${FACET_FIELD_PREFIX}.${slug}`
}

/**
 * Champ d'index de la facette **certifications** (écart 4, ÉTAPE 6). Contrairement
 * aux attributs EAV (dépendants de la catégorie, aplatis sous `attributes.<slug>`),
 * les labels de conformité sont **transverses aux catégories** : un seul champ
 * plat porte tous leurs identifiants. C'est ce champ qu'on déclare `filterableAttributes`
 * et qu'on demande en `facets` pour obtenir sa distribution (compteurs par label).
 */
export const CERTIFICATION_FACET_FIELD = 'certificationIds'

/**
 * Distribution de facettes renvoyée par le moteur (`facetDistribution` de
 * Meilisearch) : par champ de facette (`attributes.color`), le nombre de
 * produits par valeur. Les clés de valeur sont des chaînes — identifiants de
 * valeur pour les attributs énumérés, nombres pour les numériques.
 */
export type FacetDistribution = Record<string, Record<string, number>>

/** Requête de distribution de facettes (`SearchEngine#facetDistribution`). */
export interface FacetDistributionRequest {
  /** Mots-clés : la distribution porte alors sur les résultats de la recherche. */
  query: string
  filter: ProductSearchFilter
  /** Champs de facette demandés (`attributes.color`…), via `facetField`. */
  facets: string[]
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
 *   plus, ni moins). Réservé aux requêtes à filtres : une recherche hybride
 *   complète toujours la liste avec des voisins sémantiques, un filtre non ;
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
