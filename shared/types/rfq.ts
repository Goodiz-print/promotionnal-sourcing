/**
 * Statuts d'une demande de devis (RFQ), côté acheteur.
 *
 * - `draft` — en cours de rédaction : seul état où les items et la liste de
 *   fournisseurs sont modifiables ;
 * - `published` — figée et diffusable : `send` bascule les fournisseurs
 *   sélectionnés en `sent` (une RFQ peut être publiée puis envoyée à d'autres
 *   fournisseurs plus tard, d'où deux transitions distinctes) ;
 * - `closed` — l'acheteur a assez de réponses : plus aucun envoi, plus aucune
 *   réponse fournisseur acceptée.
 */
export const RFQ_STATUSES = ['draft', 'published', 'closed'] as const

export type RfqStatus = (typeof RFQ_STATUSES)[number]

export const DEFAULT_RFQ_STATUS: RfqStatus = 'draft'

/**
 * Statut d'une RFQ **pour un fournisseur donné** (table pivot `rfq_suppliers`).
 * Le cycle nominal est `pending` → `sent` → `viewed` → `responded` ;
 * `declined` est une sortie explicite du fournisseur, atteignable depuis
 * `sent` ou `viewed`.
 *
 * `pending` = fournisseur sélectionné dans le brouillon, pas encore notifié.
 */
export const RFQ_SUPPLIER_STATUSES = ['pending', 'sent', 'viewed', 'responded', 'declined'] as const

export type RfqSupplierStatus = (typeof RFQ_SUPPLIER_STATUSES)[number]

export const DEFAULT_RFQ_SUPPLIER_STATUS: RfqSupplierStatus = 'pending'

/**
 * Statuts terminaux côté fournisseur : ni un renvoi ni une consultation ne
 * doivent les faire régresser (cf. `RfqService#markViewed`).
 */
export const TERMINAL_RFQ_SUPPLIER_STATUSES: readonly RfqSupplierStatus[] = [
  'responded',
  'declined',
]

/**
 * Spécifications libres d'un item (marquage, couleur, matière…) : paires
 * clé/valeur saisies par l'acheteur, stockées en `jsonb`. Volontairement non
 * typé plus finement — la normalisation passera par les attributs du catalogue
 * quand l'item référence un produit.
 */
export type RfqItemSpecs = Record<string, string>

/**
 * Item d'une RFQ. `categoryId` et `productId` sont tous deux facultatifs : un
 * acheteur peut demander un produit précis du catalogue, une catégorie, ou
 * décrire un besoin libre (`name` reste obligatoire dans les trois cas).
 */
export interface RfqItemData {
  name: string
  description?: string | null
  quantity: number
  unit?: string | null
  categoryId?: number | null
  productId?: number | null
  specs?: RfqItemSpecs | null
}

export interface CreateRfqData {
  title: string
  description?: string | null
  deadline?: string | null
  budgetMax?: number | null
  items?: RfqItemData[]
}

export interface UpdateRfqData {
  title?: string
  description?: string | null
  deadline?: string | null
  budgetMax?: number | null
}

/**
 * DTO exposés aux pages Inertia. Déclarés en `type` (et non `interface`) pour
 * rester assignables à `Record<string, JSONDataTypes>` — contrainte de typage
 * des props Inertia, cf. `shared/types/organization.ts`.
 */
export type RfqItemType = {
  id: number
  name: string
  description: string | null
  quantity: number
  unit: string | null
  categoryId: number | null
  categoryName: string | null
  productId: number | null
  productName: string | null
  specs: RfqItemSpecs | null
}

export type RfqSupplierType = {
  id: number
  supplierOrganizationId: number
  name: string
  slug: string
  logoUrl: string | null
  status: RfqSupplierStatus
  sentAt: string | null
}

/**
 * Ligne de la liste « mes demandes ». Les compteurs évitent d'envoyer items et
 * destinataires au complet pour afficher « 3 lignes · 2 réponses sur 5 ».
 */
export type RfqType = {
  id: number
  title: string
  status: RfqStatus
  deadline: string | null
  budgetMax: string | null
  itemCount: number
  supplierCount: number
  respondedCount: number
  publishedAt: string | null
  closedAt: string | null
  createdAt: string
}

export type RfqDetailType = RfqType & {
  description: string | null
  createdByName: string | null
  items: RfqItemType[]
  suppliers: RfqSupplierType[]
}

/**
 * Organisation fournisseuse proposée dans le sélecteur de destinataires.
 */
export type SupplierOptionType = {
  id: number
  name: string
  slug: string
  logoUrl: string | null
}
