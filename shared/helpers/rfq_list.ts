import type {
  RfqBatchGroupType,
  RfqBuyerFilters,
  RfqBuyerFiltersType,
  RfqProgress,
  RfqProgressSource,
  RfqType,
} from '#shared/types/rfq'

/**
 * Avancement lisible d'une demande (#228) : son statut, une demande publiée
 * devenant « envoyée » dès qu'un destinataire est notifié, puis « répondue »
 * dès qu'un destinataire a répondu. Même règle que le filtre SQL de
 * `RfqService#listForBuyer`.
 */
export function rfqProgress({ status, sentCount, respondedCount }: RfqProgressSource): RfqProgress {
  if (status !== 'published') return status
  if (respondedCount > 0) return 'responded'
  return sentCount > 0 ? 'sent' : 'published'
}

/**
 * Regroupe les demandes par lot de panier (#229), dans l'ordre de la liste :
 * un groupe apparaît à la place de sa première demande. Une demande sans lot
 * forme un groupe à elle seule.
 */
export function groupRfqsByBatch<T extends Pick<RfqType, 'id' | 'batchId'>>(
  rfqs: T[]
): RfqBatchGroupType<T>[] {
  const groups = Map.groupBy(rfqs, (rfq) => rfq.batchId ?? `rfq-${rfq.id}`)
  return [...groups.entries()].map(([key, members]) => ({
    key,
    batchId: members[0].batchId,
    rfqs: members,
  }))
}

/**
 * Query string de « Mes demandes » pour des filtres : seuls les filtres posés
 * y figurent, pour une URL propre (`/rfqs?status=sent`) et partageable.
 */
export function rfqListQuery(filters: RfqBuyerFiltersType): Record<string, string> {
  const entries = Object.entries(filters).filter(([, value]) => value !== null)
  return Object.fromEntries(entries.map(([key, value]) => [key, String(value)]))
}

/** Au moins un filtre est posé. */
export function hasActiveRfqFilters(filters: RfqBuyerFiltersType): boolean {
  return Object.keys(rfqListQuery(filters)).length > 0
}

/** Filtres validés, tels que la page les reçoit : un filtre absent vaut `null`. */
export function rfqFiltersForPage(filters: RfqBuyerFilters): RfqBuyerFiltersType {
  return { status: filters.status ?? null, authorId: filters.authorId ?? null }
}
