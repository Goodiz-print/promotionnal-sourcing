import type { RoleSlug } from '#shared/types/role'
import type { Locale } from '#shared/types/i18n'
import type { DateTime } from 'luxon'

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
 * **répondu** (`sent` ou `viewed`, aucun message de sa part dans le fil)
 * reçoit **une** relance (`rfq_suppliers.reminded_at`, #232). L'ouverture de la
 * demande ne compte pas : un fournisseur qui travaille par mail, ou une fiche
 * sans compte, ne l'« ouvre » jamais.
 */
export const RFQ_REMINDER_AFTER_DAYS = 3

/**
 * Statut d'une RFQ **pour un fournisseur donné** (table pivot `rfq_suppliers`).
 * Le cycle nominal est `pending` → `sent` → `viewed` → `responded` ;
 * `declined` est une sortie explicite du fournisseur, atteignable depuis
 * `sent` ou `viewed`.
 *
 * `pending` = fournisseur sélectionné dans le brouillon, pas encore notifié.
 *
 * `expired` (#232) = resté sans réponse (`sent` / `viewed`) quand la demande a
 * expiré (`ExpireRfqsJob`). Le statut d'avant est gardé dans
 * `rfq_suppliers.expired_from` et rendu si l'agence prolonge l'échéance. Une
 * réponse reçue après coup le fait passer `responded`, marquée tardive.
 */
export const RFQ_SUPPLIER_STATUSES = [
  'pending',
  'sent',
  'viewed',
  'responded',
  'declined',
  'expired',
] as const

export type RfqSupplierStatus = (typeof RFQ_SUPPLIER_STATUSES)[number]

export const DEFAULT_RFQ_SUPPLIER_STATUS: RfqSupplierStatus = 'pending'

/**
 * Destinataires qui attendent encore une réponse : ils ont reçu la demande et
 * n'ont ni répondu ni décliné. Seuls eux expirent à l'échéance et peuvent être
 * relancés (s'ils n'ont, en plus, écrit aucun message dans le fil).
 */
export const AWAITING_REPLY_RFQ_SUPPLIER_STATUSES = ['sent', 'viewed'] as const

export type AwaitingReplyRfqSupplierStatus = (typeof AWAITING_REPLY_RFQ_SUPPLIER_STATUSES)[number]

/**
 * Statuts depuis lesquels une réponse par mail avec devis fait passer le
 * destinataire `responded` : `expired` compris, la réponse étant alors tardive.
 */
export const MAIL_REPLYABLE_RFQ_SUPPLIER_STATUSES = [
  ...AWAITING_REPLY_RFQ_SUPPLIER_STATUSES,
  'expired',
] as const

/**
 * Statuts terminaux côté fournisseur : ni un renvoi ni une consultation ne
 * doivent les faire régresser (cf. `RfqRecipientService#markViewed`).
 */
export const TERMINAL_RFQ_SUPPLIER_STATUSES: readonly RfqSupplierStatus[] = [
  'responded',
  'declined',
  'expired',
]

/** Ce que la règle « réponse tardive » lit d'une demande (`isLateReply`). */
export interface RfqDeadlineState {
  status: RfqStatus
  deadline: DateTime | null
}

/**
 * Rôles autorisés à répondre à une demande reçue (consulter le détail,
 * décliner, et — Phase 4 — déposer un devis). Partagé entre l'ability
 * `canRespondToRfq` et `RfqNotificationService` : notifier quelqu'un qui n'a
 * pas accès à l'écran serait une impasse.
 */
export const RFQ_RESPONDER_ROLES: readonly RoleSlug[] = ['owner', 'admin', 'manager']

/**
 * D'où vient l'adresse qui reçoit les demandes de devis d'un fournisseur
 * (#217), par ordre de priorité :
 * - `quote_email` : l'adresse de réception saisie dans le profil fournisseur ;
 * - `organization_email` : l'adresse de contact de l'organisation ;
 * - `members` : à défaut, les membres responsables (`RFQ_RESPONDER_ROLES`).
 */
export const QUOTE_ADDRESS_SOURCES = ['quote_email', 'organization_email', 'members'] as const
export type QuoteAddressSource = (typeof QUOTE_ADDRESS_SOURCES)[number]

/** Adresse à prévenir et langue dans laquelle lui écrire. */
export interface RfqMailAddress {
  email: string
  locale: Locale
}

/** Validité du lien de confirmation de l'adresse de réception (7 jours). */
export const QUOTE_EMAIL_VERIFICATION_TTL_HOURS = 168
export const QUOTE_EMAIL_VERIFICATION_SIGNATURE_PURPOSE = 'quote-email-verification'

/** Données nécessaires pour résoudre les adresses de réception d'un fournisseur. */
export interface QuoteAddressCandidates {
  quoteEmail: string | null
  /** L'adresse de réception n'est retenue qu'une fois confirmée par lien. */
  quoteEmailVerified: boolean
  organizationEmail: string | null
  /** Membres responsables, du plus ancien au plus récent. */
  members: RfqMailAddress[]
}

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
 * Données de `RfqService#create` : celles du formulaire, plus ce que seul le
 * code serveur pose. `CreateRfqData` reste la forme d'une requête HTTP.
 */
export interface NewRfqData extends CreateRfqData {
  /**
   * Lot de panier (#229) : posé par `QuoteCartService#checkout`, commun aux
   * demandes d'une même validation. Absent (→ `null`) pour une demande créée
   * seule.
   */
  batchId?: string | null
}

/**
 * Prolongation d'échéance (`RfqDeadlineService#extendDeadline`) : seule `deadline`
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
  /** Le fournisseur a répondu après l'échéance (#232). */
  lateReply: boolean
}

/**
 * Ligne de la liste « mes demandes ». Les compteurs évitent d'envoyer items et
 * destinataires au complet pour afficher « 3 lignes · 2 réponses sur 5 ».
 */
export type RfqType = {
  id: number
  /** Lot de panier partagé par les demandes d'une même validation, sinon `null` (#229). */
  batchId: string | null
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

/**
 * Avancement d'une demande tel que « Mes demandes » l'affiche et le filtre
 * (#228) : le statut de la demande, `published` détaillé selon que la demande
 * est partie chez un destinataire et qu'au moins un a répondu. Calculé par
 * `rfqProgress` (`shared/helpers/rfq_list.ts`), filtré en SQL par
 * `RfqService#listForBuyer` — les deux doivent concorder.
 *
 * - `draft` — brouillon, jamais parti ;
 * - `published` — publiée, mais encore envoyée à personne (destinataires `pending`) ;
 * - `sent` — envoyée à au moins un destinataire, aucune réponse encore ;
 * - `responded` — publiée, au moins un destinataire a répondu ;
 * - `expired` — échéance passée sans clôture ;
 * - `closed` — clôturée (par l'agence, ou par un devis retenu ou accepté).
 */
export const RFQ_PROGRESSES = [
  'draft',
  'published',
  'sent',
  'responded',
  'expired',
  'closed',
] as const

export type RfqProgress = (typeof RFQ_PROGRESSES)[number]

/** Ce que `rfqProgress` lit d'une demande. */
export interface RfqProgressSource {
  status: RfqStatus
  /** Destinataires notifiés (tout statut sauf `pending`). */
  sentCount: number
  respondedCount: number
}

/**
 * Filtres de « Mes demandes » (#228), portés par la query string
 * (`?status=responded&authorId=12`). Absents : toutes les demandes.
 */
export interface RfqBuyerFilters {
  status?: RfqProgress
  /** Auteur de la demande (`rfqs.created_by_user_id`). */
  authorId?: number
}

/** Filtres tels que la page les reçoit : `null` plutôt qu'absent. */
export type RfqBuyerFiltersType = {
  status: RfqProgress | null
  authorId: number | null
}

/**
 * Ligne de « Mes demandes » (#228) : la ligne de liste, plus l'auteur,
 * l'avancement lisible et l'indicateur « devis reçu » (PDF ou structuré).
 */
export type RfqListItemType = RfqType & {
  createdByName: string | null
  progress: RfqProgress
  hasReceivedQuote: boolean
}

/**
 * Groupe de « Mes demandes » : les demandes d'un même lot de panier (#229),
 * ou une demande seule (`batchId` à `null`). `key` est stable pour le rendu.
 */
export type RfqBatchGroupType<T extends Pick<RfqType, 'id' | 'batchId'> = RfqListItemType> = {
  key: string
  batchId: string | null
  rfqs: T[]
}

/** Auteur proposé par le filtre de « Mes demandes ». */
export type RfqAuthorOptionType = {
  id: number
  name: string
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
  /**
   * Agence acheteuse, **`null` pour un fournisseur non abonné** (#220) : la
   * demande lui reste anonyme. La règle s'évalue à la lecture, côté serveur
   * (`SubscriptionService#isSubscribed`) : la donnée n'atteint jamais le
   * navigateur d'un non abonné.
   */
  buyerName: string | null
  buyerLogoUrl: string | null
  myStatus: RfqSupplierStatus
  /** Ce fournisseur a répondu après l'échéance (#232). */
  myLateReply: boolean
  sentAt: string | null
  publishedAt: string | null
}

/**
 * Coordonnées de l'agence transmises à un fournisseur **abonné** (#221), pour
 * qu'il la contacte en direct. `email` est l'adresse de contact de l'agence, à
 * défaut celle de l'auteur de la demande ; `addressLines` est l'adresse postale
 * prête à afficher (pays dans la langue du lecteur), vide si rien n'est saisi.
 */
export type BuyerContactType = {
  agencyName: string
  requesterName: string | null
  email: string | null
  phone: string | null
  addressLines: string[]
}

/** Ce que `buyerContactOf` lit de l'agence et de l'auteur de la demande. */
export interface BuyerContactSource {
  organization: {
    name: string
    email: string | null
    phone: string | null
    addressLine1: string | null
    addressLine2: string | null
    postalCode: string | null
    city: string | null
    country: string | null
  }
  /** `null` : auteur inconnu (ancienne demande) ou parti depuis. */
  requester: { fullName: string | null; email: string } | null
}

export type SupplierRfqDetailType = SupplierRfqType & {
  description: string | null
  items: RfqItemType[]
  /** `null` pour un fournisseur non abonné (#220) : rien ne fuit de l'agence. */
  buyerContact: BuyerContactType | null
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
 * Ce que la fiche produit sait de l'acheteur connecté. Toujours défini (jamais
 * `null`, que le sérialiseur de props refuse) : un visiteur anonyme reçoit
 * `canCreateRfq: false`.
 *
 * `inCartVariantIds` : variantes de ce produit déjà dans le panier de devis
 * de l'utilisateur (`null` = ligne sans variante précisée) — la fiche en
 * déduit l'état « dans votre panier » de la variante choisie
 * (cf. `docs/quote-cart.md`).
 */
export type ProductRfqContextType = {
  canCreateRfq: boolean
  inCartVariantIds: (number | null)[]
}

/**
 * Quantité retenue quand le produit n'impose pas de minimum : la validation
 * exige un entier positif, et « 1 » est la valeur neutre à corriger.
 */
export const DEFAULT_RFQ_ITEM_QUANTITY = 1
