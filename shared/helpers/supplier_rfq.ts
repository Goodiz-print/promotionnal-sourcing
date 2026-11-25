import {
  QUOTE_UPLOAD_ACCEPTING_RFQ_STATUSES,
  QUOTE_UPLOAD_REFUSED_RFQ_SUPPLIER_STATUSES,
  SUPPLIER_RFQ_STATES,
  SUPPLIER_RFQ_STATE_STATUSES,
  type RfqStatus,
  type RfqSupplierStatus,
  type SupplierRfqFilters,
  type SupplierRfqFiltersType,
  type SupplierRfqState,
} from '../types/rfq.js'

/**
 * Statut lisible d'une demande reçue (#230), d'après le statut du destinataire
 * (`SUPPLIER_RFQ_STATE_STATUSES`, même correspondance que le filtre SQL de
 * `RfqService#listForSupplier`). Une ligne `pending` n'est jamais montrée au
 * fournisseur ; si elle l'était, elle serait « à traiter ».
 */
export function supplierRfqState(status: RfqSupplierStatus): SupplierRfqState {
  const state = SUPPLIER_RFQ_STATES.find((candidate) =>
    SUPPLIER_RFQ_STATE_STATUSES[candidate].includes(status)
  )
  return state ?? 'to_process'
}

/**
 * Query string de « Demandes reçues » pour des filtres : seuls les filtres
 * posés y figurent (`/supplier/rfqs?status=expired`).
 */
export function supplierRfqListQuery(filters: SupplierRfqFiltersType): Record<string, string> {
  return filters.status ? { status: filters.status } : {}
}

/** Filtres validés, tels que la page les reçoit : un filtre absent vaut `null`. */
export function supplierRfqFiltersForPage(filters: SupplierRfqFilters): SupplierRfqFiltersType {
  return { status: filters.status ?? null }
}

/**
 * Le destinataire peut-il encore déposer un devis PDF (#230) ? Ni une demande
 * non envoyée, ni une demande qu'il a déclinée. Lu par l'ability
 * `canUploadRfqQuoteDocument` et, sous verrou, par `SupplierReplyService#recordUpload`.
 */
export function acceptsQuoteUpload(status: RfqSupplierStatus): boolean {
  return !QUOTE_UPLOAD_REFUSED_RFQ_SUPPLIER_STATUSES.includes(status)
}

/**
 * La demande accepte-t-elle encore un devis PDF déposé depuis l'écran (#290) ?
 * Pas une fois clôturée (`QUOTE_UPLOAD_ACCEPTING_RFQ_STATUSES`). Lu par
 * l'ability `canUploadRfqQuoteDocument`, avec `acceptsQuoteUpload` (statut du
 * destinataire) et la fenêtre de l'adresse relais.
 */
export function rfqAcceptsQuoteUpload(status: RfqStatus): boolean {
  return QUOTE_UPLOAD_ACCEPTING_RFQ_STATUSES.includes(status)
}
