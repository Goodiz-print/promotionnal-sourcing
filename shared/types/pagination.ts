/**
 * Métadonnées de pagination exposées au frontend (issues du paginator Lucid).
 */
export type PaginationMeta = {
  total: number
  perPage: number
  currentPage: number
  lastPage: number
}

/**
 * Enveloppe générique d'une liste paginée sérialisée pour Inertia.
 */
export type Paginated<T> = {
  data: T[]
  meta: PaginationMeta
}
