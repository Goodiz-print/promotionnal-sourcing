import type { QueueHealthReport } from '#shared/types/health'

/** États d'un job dans `queue_jobs` (@boringnode/queue). */
export const QUEUE_JOB_STATUSES = ['pending', 'delayed', 'active', 'completed', 'failed'] as const
export type QueueJobStatus = (typeof QUEUE_JOB_STATUSES)[number]

/** Horodatages bruts d'un job parmi lesquels choisir celui à afficher. */
export interface QueueJobTimes {
  finishedAt: string | number | null
  acquiredAt: string | number | null
  dueAt: string | number | null
}

/**
 * Valeurs du filtre « état » de la liste : les états de la queue, plus `stuck`
 * (job actif acquis depuis plus que `QUEUE_THRESHOLDS.activeStuckMs`).
 */
export const QUEUE_JOB_FILTER_STATUSES = [...QUEUE_JOB_STATUSES, 'stuck'] as const
export type QueueJobFilterStatus = (typeof QUEUE_JOB_FILTER_STATUSES)[number]

/** Filtres de la liste des jobs (query string), tous optionnels. */
export type AdminQueueFilters = {
  status: QueueJobFilterStatus | null
  /** Nom de la classe du job, recherche partielle. */
  name: string | null
}

/** Taille maximale de l'erreur et de la charge utile affichées sur la fiche. */
export const QUEUE_DETAIL_MAX_LENGTH = 4000
/** Taille maximale de l'erreur résumée dans la liste. */
export const QUEUE_ERROR_SUMMARY_LENGTH = 200

/** Ligne brute de la requête de liste (snake_case, avant présentation). */
export type AdminQueueJobDbRow = {
  id: string
  queue: string
  status: string
  name: string | null
  attempts: string | number | null
  /** Horodatages en millisecondes (bigint renvoyé en chaîne par pg). */
  acquired_at: string | number | null
  execute_at: string | number | null
  finished_at: string | number | null
  /** `score % 1e13` : date de mise en file des jobs `pending`. */
  enqueued_at: string | number | null
  error: string | null
}

export type AdminQueueJobRow = {
  id: string
  queue: string
  name: string
  status: QueueJobStatus
  attempts: number
  /** Date utile à l'état : mise en file, échéance, acquisition ou fin. */
  at: string | null
  /** Actif depuis plus longtemps que le seuil : worker figé ou tué. */
  stuck: boolean
  /** `pending` / `delayed` en retard au-delà du seuil de la queue. */
  overdue: boolean
  /** Début de l'erreur (une ligne), pour la liste. */
  error: string | null
  retryable: boolean
  cancellable: boolean
}

export type AdminQueueJobDetail = AdminQueueJobRow & {
  workerId: string | null
  acquiredAt: string | null
  executeAt: string | null
  finishedAt: string | null
  /** Charge utile JSON, tronquée à `QUEUE_DETAIL_MAX_LENGTH`. */
  payload: string
  /** Erreur complète (trace), tronquée à `QUEUE_DETAIL_MAX_LENGTH`. */
  fullError: string | null
}

export type AdminQueueScheduleRow = {
  id: string
  /** Nom de la classe du job planifié. */
  name: string
  cron: string | null
  everyMs: number | null
  timezone: string
  status: string
  runCount: number
  lastRunAt: string | null
  nextRunAt: string | null
  /** Lancement manuel possible (job de maintenance sans charge utile). */
  runnable: boolean
}

export type AdminQueueOverview = {
  health: QueueHealthReport
  counts: Record<QueueJobStatus, number>
  schedules: AdminQueueScheduleRow[]
}
