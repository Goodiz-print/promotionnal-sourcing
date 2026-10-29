import type { OrderAction, OrderSide, OrderStatus } from '#shared/types/order'
import type { BadgeTone } from '~/types/ui'

/**
 * Tonalité de la pastille par statut : l'attente reste neutre, l'avancement est
 * informatif, la livraison est le seul succès, l'annulation une impasse.
 */
export const ORDER_STATUS_TONES: Record<OrderStatus, BadgeTone> = {
  pending: 'warning',
  confirmed: 'info',
  in_production: 'info',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'danger',
}

/** Route de chaque action, par côté — les noms sont ceux de `start/routes/orders.ts`. */
export const ORDER_ACTION_ROUTES = {
  buyer: {
    deliver: 'orders.deliver',
    cancel: 'orders.cancel',
  },
  supplier: {
    confirm: 'supplier.orders.confirm',
    startProduction: 'supplier.orders.produce',
    ship: 'supplier.orders.ship',
    cancel: 'supplier.orders.cancel',
  },
} as const

/** Route de l'action pour ce côté, ou `undefined` si ce côté ne la propose pas. */
export function actionRoute(side: OrderSide, action: OrderAction) {
  const routes: Partial<Record<OrderAction, string>> = ORDER_ACTION_ROUTES[side]
  return routes[action] as
    | (typeof ORDER_ACTION_ROUTES)['buyer'][keyof (typeof ORDER_ACTION_ROUTES)['buyer']]
    | (typeof ORDER_ACTION_ROUTES)['supplier'][keyof (typeof ORDER_ACTION_ROUTES)['supplier']]
    | undefined
}

/** Date et heure affichées dans la langue de l'utilisateur. */
export function formatDateTime(value: string, locale: string): string {
  return new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
}
