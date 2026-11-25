import type { PaginationMeta } from '../types/pagination.js'

/** Paginator Lucid (`total`, `perPage`, `currentPage`, `lastPage`) réduit à ce que reçoit le frontend. */
export function toPaginationMeta(meta: {
  total: number | string
  perPage: number
  currentPage: number
  lastPage: number
}): PaginationMeta {
  return {
    total: Number(meta.total),
    perPage: meta.perPage,
    currentPage: meta.currentPage,
    lastPage: Math.max(1, meta.lastPage),
  }
}

/** Page à afficher : celle demandée, ramenée à la dernière quand elle la dépasse. */
export function clampPage(requested: number, lastPage: number): number {
  return Math.min(requested, Math.max(1, lastPage))
}
