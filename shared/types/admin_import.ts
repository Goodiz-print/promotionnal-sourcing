import type { ImportKind, ImportRowError, ImportStatus } from '#shared/types/import_job'

/**
 * Le moteur qui traite réellement un import (#77) n'est pas branché : tant que
 * c'est `false`, la fiche prévient qu'une relance échouera aussitôt. À passer à
 * `true` avec #77.
 */
export const IMPORT_ENGINE_AVAILABLE = false

/** Filtres de la liste des imports (query string), tous optionnels. */
export type AdminImportFilters = {
  status: ImportStatus | null
  kind: ImportKind | null
  /** Nom d'organisation, recherche partielle. */
  organization: string | null
}

/** Un import `pending` ou `running` sans activité depuis plus longtemps est considéré perdu (worker arrêté). */
export const IMPORT_STALE_MINUTES = 60

/** Ligne brute de la requête de liste / détail (snake_case, avant présentation). */
export type AdminImportDbRow = {
  id: number
  kind: string
  status: string
  total_rows: number
  processed_rows: number
  error_count: number
  errors: ImportRowError[] | string
  organization_id: number
  organization_name: string
  created_by_user_id: number | null
  creator_email: string | null
  retry_of_import_id: number | null
  retried_by_import_id: number | null
  source_storage_object_id: number | null
  started_at: Date | string | null
  finished_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string | null
}

export type AdminImportRow = {
  id: number
  kind: ImportKind
  status: ImportStatus
  totalRows: number
  processedRows: number
  errorCount: number
  organization: { id: number; name: string }
  createdBy: string | null
  retryOfId: number | null
  /** Import créé pour relancer celui-ci, s'il existe. */
  retriedById: number | null
  /** Échoué (ou perdu) et pas encore relancé. */
  retryable: boolean
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
}

/** Erreur de ligne présentée à l'écran : toutes les clés présentes (props Inertia sérialisables). */
export type AdminImportError = {
  row: number
  message: string
  column: string | null
  receivedValue: string | null
}

export type AdminImportDetail = AdminImportRow & {
  /** Erreurs conservées (100 au plus) ; `errorCount` donne le total réel. */
  errors: AdminImportError[]
  hasSourceFile: boolean
}

/** Données du job de queue qui traite un import. */
export type RunImportPayload = {
  importJobId: number
}
