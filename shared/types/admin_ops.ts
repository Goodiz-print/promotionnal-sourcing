import type { MailKind } from './mail.js'
import type { StorageStatus } from './storage.js'

/**
 * Supervision des emails en échec et du stockage Cellar (#178), droit
 * `ops.manage`.
 */

/**
 * État **affiché** d'un envoi. `mail_deliveries` ne connaît que `sent` et `failed` ;
 * une ligne `failed` modifiée depuis moins de `MAIL_IN_PROGRESS_MINUTES` est
 * `in_progress` (premier essai ou nouvel essai de la queue, ou rejeu demandé),
 * au-delà elle est `failed` : la dead-letter, la seule rejouable.
 */
export const ADMIN_MAIL_STATUSES = ['failed', 'in_progress', 'sent'] as const
export type AdminMailStatus = (typeof ADMIN_MAIL_STATUSES)[number]

/** Délai après lequel une ligne `failed` n'est plus considérée comme en cours. */
export const MAIL_IN_PROGRESS_MINUTES = 30

/** Fenêtre (jours) des taux d'échec par type de mail. */
export const MAIL_RATE_WINDOW_DAYS = 30

/** Nombre maximal de mails remis en file par un rejeu groupé. */
export const MAIL_BULK_RETRY_LIMIT = 200

/** Taille maximale de l'erreur affichée sur la fiche. */
export const MAIL_ERROR_MAX_LENGTH = 4000

/** Taille maximale de l'erreur résumée dans la liste. */
export const MAIL_ERROR_SUMMARY_LENGTH = 160

export type AdminMailFilters = {
  status: AdminMailStatus | null
  kind: MailKind | null
}

export type AdminMailRow = {
  id: number
  kind: string
  to: string
  status: AdminMailStatus
  attempts: number
  /** Première ligne de l'erreur, tronquée. */
  error: string | null
  createdAt: string
  updatedAt: string
  sentAt: string | null
  /** Dead-letter dont la charge est encore disponible. */
  retryable: boolean
}

/** Fiche d'un envoi : l'erreur complète, jamais la charge (URL signées, données personnelles). */
export type AdminMailDetail = AdminMailRow & {
  idempotencyKey: string
  fullError: string | null
}

/** Taux d'échec d'un type de mail sur `MAIL_RATE_WINDOW_DAYS` jours. */
export type AdminMailKindRate = {
  kind: MailKind
  sent: number
  failed: number
  inProgress: number
  /** `failed / (sent + failed)`, `null` sans envoi terminé. */
  failureRate: number | null
}

export type AdminMailOverview = {
  windowDays: number
  /** Dead-letter rejouable, tous types confondus. */
  failedTotal: number
  rates: AdminMailKindRate[]
}

/**
 * Résultat d'un rejeu : mails remis en file, mises en queue en échec (rendues à la
 * dead-letter) et lignes sans charge (rejeu impossible).
 */
export type AdminMailRetryResult = {
  requeued: number
  failed: number
  skipped: number
}

/** Un état de stockage : nombre d'objets et octets. */
export type AdminStorageStatusTotal = {
  status: StorageStatus
  count: number
  bytes: number
}

/** Ligne `pending_*` plus ancienne que le seuil de reprise. */
export type AdminStorageStaleRow = {
  id: number
  key: string
  status: StorageStatus
  size: number
  createdAt: string
}

/** Volume stocké (`ready`) rattaché à une organisation. */
export type AdminStorageOrganizationRow = {
  organizationId: number
  name: string
  count: number
  bytes: number
}

export type AdminStorageOverview = {
  totals: AdminStorageStatusTotal[]
  thresholdHours: number
  staleCount: number
  /** Les plus anciennes lignes en retard, limitées à `STORAGE_STALE_LIST_LIMIT`. */
  stale: AdminStorageStaleRow[]
  /** Octets `ready` qu'aucune organisation ne référence (ou dont le propriétaire est inconnu). */
  unattributedBytes: number
  organizations: AdminStorageOrganizationRow[]
}

/** Nombre de lignes en retard listées. */
export const STORAGE_STALE_LIST_LIMIT = 50

/** Nombre d'organisations listées dans le volume par organisation. */
export const STORAGE_ORGANIZATION_LIMIT = 20
