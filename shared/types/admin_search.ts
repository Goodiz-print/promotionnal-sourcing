import type { SearchEvaluationReport } from '#shared/types/search'

/** Types d'opération lancées depuis le back-office (table `search_runs`). */
export const SEARCH_RUN_KINDS = ['reindex', 'evaluation'] as const
export type SearchRunKind = (typeof SEARCH_RUN_KINDS)[number]

export const SEARCH_RUN_STATUSES = ['pending', 'running', 'completed', 'failed'] as const
export type SearchRunStatus = (typeof SEARCH_RUN_STATUSES)[number]

/**
 * Au-delà, une opération « en cours » est tenue pour perdue (worker tué en
 * route) : elle ne bloque plus une nouvelle demande.
 */
export const SEARCH_RUN_STALE_MS = 2 * 60 * 60_000

/** Nombre d'opérations de chaque type affichées dans l'historique. */
export const SEARCH_RUN_HISTORY = 10

/** Tâches Meilisearch récentes affichées sur l'écran. */
export const SEARCH_TASKS_SHOWN = 10

/** Produits d'exemple listés pour chaque sens de l'écart PostgreSQL ↔ index. */
export const SEARCH_DRIFT_SAMPLE = 20

/** Taille d'une page d'identifiants lue dans l'index. */
export const SEARCH_ID_PAGE_SIZE = 1000

/** Délai maximal d'une sonde du moteur depuis l'écran (ms). */
export const SEARCH_PROBE_TIMEOUT_MS = 5000

/** Longueur maximale du message d'erreur conservé. */
export const SEARCH_ERROR_MAX_LENGTH = 500

/** Tâche Meilisearch résumée (aucune donnée de produit). */
export type SearchTaskSummary = {
  uid: number
  type: string
  status: string
  enqueuedAt: string | null
  finishedAt: string | null
  /** Message d'erreur de la tâche en échec. */
  error: string | null
}

/** Ce que le moteur dit de l'index actif ; lève s'il est injoignable. */
export type SearchEngineInfo = {
  /** `false` tant qu'aucune réindexation n'a créé l'index. */
  indexExists: boolean
  documents: number
  /** Meilisearch traite des écritures en ce moment. */
  indexing: boolean
  tasks: SearchTaskSummary[]
}

/** État du moteur : `disabled` (pas de `MEILISEARCH_HOST`), `unreachable` ou `ready`. */
export type SearchEngineState = 'disabled' | 'unreachable' | 'ready'

export type AdminSearchStatus = {
  state: SearchEngineState
  index: string
  embedder: { enabled: boolean; provider: string; model: string }
  semanticRatio: number
  /** Renseigné quand `state === 'ready'`. */
  info: SearchEngineInfo | null
  /** Message du moteur quand `state === 'unreachable'`. */
  error: string | null
}

export type AdminSearchDrift = {
  /** Produits visibles dans PostgreSQL / documents dans l'index. */
  expected: number
  indexed: number
  /** Visibles dans PostgreSQL mais absents de l'index. */
  missing: number[]
  missingCount: number
  /** Dans l'index mais plus visibles dans PostgreSQL. */
  extra: number[]
  extraCount: number
  checkedAt: string
}

/** Synthèse d'une évaluation : le rapport sans le détail des requêtes réussies. */
export type SearchEvaluationSummary = Omit<SearchEvaluationReport, 'results'> & {
  failures: { id: string; query: string; missing: string[]; unexpected: string[] }[]
}

export type SearchReindexResult = { indexed: number }

export type AdminSearchRun = {
  id: number
  kind: SearchRunKind
  status: SearchRunStatus
  supplierId: number | null
  supplierName: string | null
  processed: number
  total: number | null
  /** Avancement en pourcentage (0-100), `null` tant que le total est inconnu. */
  progress: number | null
  evaluation: SearchEvaluationSummary | null
  indexed: number | null
  error: string | null
  requestedBy: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

export type AdminSearchOverview = {
  status: AdminSearchStatus
  reindexRuns: AdminSearchRun[]
  evaluationRuns: AdminSearchRun[]
  /** Une opération est en cours : l'écran se rafraîchit seul. */
  active: boolean
}

/** Issue d'une demande de réindexation ou d'évaluation. */
export type SearchRequestResult =
  'queued' | 'disabled' | 'busy' | 'unknown_supplier' | 'queue_failed'

/** Ligne brute de `search_runs` (snake_case, avant présentation). */
export type AdminSearchRunDbRow = {
  id: number
  kind: string
  status: string
  supplier_id: number | null
  supplier_name: string | null
  processed: number
  total: number | null
  result: unknown
  error: string | null
  requested_by_email: string | null
  created_at: Date | string
  started_at: Date | string | null
  finished_at: Date | string | null
}
