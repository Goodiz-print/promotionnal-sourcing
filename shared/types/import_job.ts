/**
 * Imports en masse suivis. Le `kind` est une chaîne ouverte en base : un nouvel
 * import (flux API, autre format) = une entrée ici.
 */
export const IMPORT_KINDS = ['products_csv', 'suppliers_csv'] as const

export type ImportKind = (typeof IMPORT_KINDS)[number]

/**
 * Cycle : `pending` → `running` → `completed` | `failed`. Un import `failed`
 * peut être relancé en créant un nouveau job (on ne réécrit pas l'historique).
 */
export const IMPORT_STATUSES = ['pending', 'running', 'completed', 'failed'] as const

export type ImportStatus = (typeof IMPORT_STATUSES)[number]

/** Nombre maximal d'erreurs conservées par import ; le compteur reste exact au-delà. */
export const IMPORT_MAX_STORED_ERRORS = 100

export interface ImportRowError {
  row: number
  message: string
}
