import type { RoleSlug } from '#shared/types/role'

/**
 * Statuts d'une demande de devis (RFQ), côté acheteur.
 *
 * - `draft` — en cours de rédaction : seul état où les items et la liste de
 *   fournisseurs sont modifiables ;
 * - `published` — figée et diffusable : `send` bascule les fournisseurs
 *   sélectionnés en `sent` (une RFQ peut être publiée puis envoyée à d'autres
 *   fournisseurs plus tard, d'où deux transitions distinctes) ;
 * - `closed` — l'acheteur a assez de réponses : plus aucun envoi, plus aucune
 *   réponse fournisseur acceptée ;
 * - `expired` — l'échéance est passée sans que l'acheteur ait clôturé
 *   (`ExpireRfqsJob`). Comme `closed`, plus d'envoi ni de réponse ; mais
 *   l'acheteur peut la rouvrir en prolongeant l'échéance. Les destinataires
 *   gardent leur statut (trace de qui avait lu, répondu ou décliné).
 */
export const RFQ_STATUSES = ['draft', 'published', 'closed', 'expired'] as const

export type RfqStatus = (typeof RFQ_STATUSES)[number]

export const DEFAULT_RFQ_STATUS: RfqStatus = 'draft'

/**
 * Fuseau dans lequel s'évalue l'échéance. Une échéance est une **date** saisie
 * par l'acheteur : « 30 octobre » laisse toute la journée du 30 aux
 * fournisseurs, la demande est échue le 31 à 00:00 (heure de Paris).
 */
export const RFQ_DEADLINE_TIMEZONE = 'Europe/Paris'

/**
 * Délai, en jours après l'envoi, au bout duquel un fournisseur qui n'a pas
 * ouvert la demande (`sent`, jamais `viewed`) reçoit **une** relance
 * (`rfq_suppliers.reminded_at`).
 */
export const RFQ_REMINDER_AFTER_DAYS = 3

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
 * Rôles autorisés à répondre à une demande reçue (consulter le détail,
 * décliner, et — Phase 4 — déposer un devis). Partagé entre l'ability
 * `canRespondToRfq` et `RfqNotificationService` : notifier quelqu'un qui n'a
 * pas accès à l'écran serait une impasse.
 */
export const RFQ_RESPONDER_ROLES: readonly RoleSlug[] = ['owner', 'admin', 'manager']

/**
 * Rôles de l'organisation acheteuse qui pilotent une demande (publier, clore,
 * accepter un devis). Alignés sur l'ability `canManageRfq` ; ce sont aussi eux
 * que prévient `QuoteNotificationService` quand un devis arrive.
 */
export const RFQ_MANAGER_ROLES: readonly RoleSlug[] = ['owner', 'admin', 'manager']

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

/**
 * Prolongation d'échéance (`RfqService#extendDeadline`) : seule `deadline`
 * change, jamais le besoin — exception assumée à « seul un brouillon est
 * modifiable », cf. `docs/rfq.md`.
 */
export interface ExtendRfqDeadlineData {
  deadline: string
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
  productSlug: string | null
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
  expiredAt: string | null
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

/**
 * Ligne « demandes reçues » côté **fournisseur**. Le point de vue est inversé :
 * l'organisation affichée est l'acheteuse, et `myStatus` porte l'avancement de
 * *ce* destinataire (colonne `rfq_suppliers.status`), pas celui de la demande
 * chez les autres fournisseurs consultés — un fournisseur n'a pas à savoir qui
 * d'autre a été consulté, ni qui a déjà répondu.
 *
 * `budgetMax` est volontairement **absent** : le budget plafond de l'acheteur
 * est une donnée de négociation interne, il ne part pas chez les fournisseurs.
 */
export type SupplierRfqType = {
  id: number
  title: string
  status: RfqStatus
  deadline: string | null
  itemCount: number
  buyerName: string
  buyerLogoUrl: string | null
  myStatus: RfqSupplierStatus
  sentAt: string | null
  publishedAt: string | null
}

export type SupplierRfqDetailType = SupplierRfqType & {
  description: string | null
  items: RfqItemType[]
}

/**
 * Produit du catalogue tel que le formulaire RFQ le manipule : de quoi remplir
 * une ligne (désignation, catégorie, quantité minimale) et cocher le
 * fournisseur. Réponse du sélecteur de produit **et** pré-remplissage depuis
 * une fiche.
 *
 * `supplierOrganizationId` est `null` pour une fiche fournisseur importée mais
 * pas encore rattachée à une organisation : il n'y a alors personne à consulter.
 */
export type RfqProductOptionType = {
  id: number
  slug: string
  name: string
  categoryId: number | null
  minQuantity: number | null
  supplierName: string | null
  supplierOrganizationId: number | null
}

/** Résultat de la recherche du sélecteur de produit (`unavailable` : moteur injoignable). */
export interface RfqProductLookupType {
  results: RfqProductOptionType[]
  unavailable: boolean
}

/**
 * Brouillon proposé dans le menu « ajouter à une demande » d'une fiche produit.
 */
export type RfqDraftOptionType = {
  id: number
  title: string
}

/**
 * Ce que la fiche produit sait de l'acheteur connecté. Toujours défini (jamais
 * `null`, que le sérialiseur de props refuse) : un visiteur anonyme reçoit
 * `canCreateRfq: false`.
 *
 * `drafts` n'est rempli que pour qui peut piloter une demande : modifier un
 * brouillon relève de `canManageRfq`, pas de `canCreateRfq`.
 */
export type ProductRfqContextType = {
  canCreateRfq: boolean
  drafts: RfqDraftOptionType[]
}

/**
 * Quantité retenue quand le produit n'impose pas de minimum : la validation
 * exige un entier positif, et « 1 » est la valeur neutre à corriger.
 */
export const DEFAULT_RFQ_ITEM_QUANTITY = 1
