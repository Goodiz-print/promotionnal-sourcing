/**
 * Statuts d'une commande (#6), créée à l'acceptation d'un devis.
 *
 * ```
 * pending ──confirm──▶ confirmed ──startProduction──▶ in_production ──ship──▶ shipped ──deliver──▶ delivered
 *    │                     │
 *    └─────────cancel──────┴──▶ cancelled
 * ```
 *
 * - `pending` — créée, en attente de la confirmation du fournisseur ;
 * - `confirmed` / `in_production` / `shipped` — avancement, piloté par le fournisseur ;
 * - `delivered` — la réception est confirmée par l'acheteur ;
 * - `cancelled` — annulée avant le lancement en production, par l'un ou l'autre.
 */
export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'in_production',
  'shipped',
  'delivered',
  'cancelled',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const DEFAULT_ORDER_STATUS: OrderStatus = 'pending'

/** Transitions de statut. Chacune ne part que de certains statuts. */
export const ORDER_ACTIONS = ['confirm', 'startProduction', 'ship', 'deliver', 'cancel'] as const

export type OrderAction = (typeof ORDER_ACTIONS)[number]

export interface OrderTransition {
  from: readonly OrderStatus[]
  to: OrderStatus
  /** Colonne horodatée à l'arrivée dans le statut cible. */
  timestamp: 'confirmedAt' | 'inProductionAt' | 'shippedAt' | 'deliveredAt' | 'cancelledAt'
}

export const ORDER_TRANSITIONS: Record<OrderAction, OrderTransition> = {
  confirm: { from: ['pending'], to: 'confirmed', timestamp: 'confirmedAt' },
  startProduction: { from: ['confirmed'], to: 'in_production', timestamp: 'inProductionAt' },
  ship: { from: ['in_production'], to: 'shipped', timestamp: 'shippedAt' },
  deliver: { from: ['shipped'], to: 'delivered', timestamp: 'deliveredAt' },
  cancel: { from: ['pending', 'confirmed'], to: 'cancelled', timestamp: 'cancelledAt' },
}

/** Côté d'où l'on regarde la commande : il détermine les actions disponibles. */
export type OrderSide = 'buyer' | 'supplier'

/** Actions ouvertes à chaque côté. `cancel` est partagé. */
export const ORDER_SIDE_ACTIONS: Record<OrderSide, readonly OrderAction[]> = {
  supplier: ['confirm', 'startProduction', 'ship', 'cancel'],
  buyer: ['deliver', 'cancel'],
}

/** Adresse figée sur la commande : une modification ultérieure de l'organisation ne la change pas. */
export type OrderAddress = {
  name: string
  line1: string | null
  line2: string | null
  postalCode: string | null
  city: string | null
  country: string
}

/** Options de personnalisation reprises du devis (marquage, matière…). */
export type OrderCustomizationDetails = Record<string, string>

export type OrderItemType = {
  id: number
  /** Libellé de l'item, figé à la création de la commande. */
  name: string
  productId: number | null
  quantity: number
  unitPrice: number
  totalPrice: number
  customizationDetails: OrderCustomizationDetails | null
}

/** Date de passage dans chaque statut atteint ; `null` tant qu'il ne l'est pas. */
export type OrderTimelineType = {
  createdAt: string
  confirmedAt: string | null
  inProductionAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
}

/**
 * Commande telle que l'écran la reçoit. `actions` liste ce que l'utilisateur
 * peut faire **maintenant** de son côté : le serveur décide, le client affiche.
 */
export type OrderType = {
  id: number
  quoteId: number
  rfqId: number
  rfqTitle: string
  status: OrderStatus
  buyerName: string
  supplierName: string
  shippingAddress: OrderAddress | null
  billingAddress: OrderAddress | null
  totalAmount: number
  currency: string
  timeline: OrderTimelineType
  actions: OrderAction[]
  items: OrderItemType[]
}
