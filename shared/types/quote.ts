/**
 * Statuts d'un devis fournisseur (#5).
 *
 * ```
 * draft ──submit──▶ submitted ──accept──▶ accepted
 *   │                   │  └──reject──▶ rejected   (refus, ou perdant d'un devis accepté)
 *   └───────────────────┴──expire────▶ expired     (demande échue, validité dépassée)
 * ```
 *
 * - `draft` — en rédaction chez le fournisseur, invisible de l'acheteur ;
 * - `submitted` — remis : figé, comparable par l'acheteur ;
 * - `accepted` / `rejected` — décision de l'acheteur. Accepter un devis rejette
 *   automatiquement les autres devis remis de la demande ;
 * - `expired` — la demande est échue ou la date de validité est passée.
 */
export const QUOTE_STATUSES = ['draft', 'submitted', 'accepted', 'rejected', 'expired'] as const

export type QuoteStatus = (typeof QUOTE_STATUSES)[number]

export const DEFAULT_QUOTE_STATUS: QuoteStatus = 'draft'

/**
 * Statuts « vivants » : un fournisseur n'a qu'un devis dans l'un d'eux par
 * demande (index unique partiel de `quotes`).
 */
export const LIVE_QUOTE_STATUSES: readonly QuoteStatus[] = ['draft', 'submitted', 'accepted']

/** Statuts qu'un acheteur voit : un brouillon reste le secret du fournisseur. */
export const BUYER_VISIBLE_QUOTE_STATUSES: readonly QuoteStatus[] = [
  'submitted',
  'accepted',
  'rejected',
  'expired',
]

/** Seule devise gérée pour l'instant ; la colonne existe déjà pour la suite. */
export const DEFAULT_QUOTE_CURRENCY = 'EUR'

/**
 * Options de personnalisation proposées sur une ligne (marquage, matière…) :
 * paires clé/valeur libres, stockées en `jsonb`, comme `RfqItemSpecs`.
 */
export type QuoteCustomizationDetails = Record<string, string>

/** Ligne saisie par le fournisseur. Les totaux sont calculés côté serveur. */
export interface QuoteItemData {
  rfqItemId: number
  unitPrice: number
  /** Quantité chiffrée — peut différer du besoin (palier, minimum de commande). */
  quantity: number
  leadTimeDays: number
  customizationDetails?: QuoteCustomizationDetails | null
}

/** Formulaire de devis (création et mise à jour d'un brouillon). */
export interface QuoteData {
  /** Date au format ISO (`AAAA-MM-JJ`), facultative. */
  validUntil?: string | null
  notes?: string | null
  items: QuoteItemData[]
}

/** Ligne de devis telle que l'écran la reçoit (montants en nombres). */
export type QuoteItemType = {
  id: number
  rfqItemId: number
  /** Libellé de l'item de la demande (`rfq_items.name`). */
  rfqItemName: string
  productId: number | null
  unitPrice: number
  quantity: number
  totalPrice: number
  leadTimeDays: number
  customizationDetails: QuoteCustomizationDetails | null
}

/**
 * Devis tel que l'écran le reçoit, côté acheteur comme côté fournisseur.
 * `supplierName` désigne l'auteur ; `rfqTitle` la demande à laquelle il répond.
 */
export type QuoteType = {
  id: number
  rfqId: number
  rfqTitle: string
  status: QuoteStatus
  supplierOrganizationId: number
  supplierName: string
  validUntil: string | null
  notes: string | null
  totalAmount: number
  currency: string
  submittedAt: string | null
  decidedAt: string | null
  /** Plus long délai de ses lignes — le délai du devis dans son ensemble. */
  leadTimeDays: number
  items: QuoteItemType[]
}

/** Devis d'un fournisseur sur une demande, tel que l'écran de la demande le résume. */
export type RfqQuoteSummaryType = {
  id: number
  status: QuoteStatus
}

/**
 * Devis du fournisseur reçu en PDF (#224), à enregistrer pour un destinataire.
 * Son fichier est la pièce jointe du message qui l'a apporté.
 */
export interface QuoteDocumentInput {
  rfqId: number
  rfqSupplierId: number
  messageId: number
  messageAttachmentId: number
  receivedAt: Date
}
