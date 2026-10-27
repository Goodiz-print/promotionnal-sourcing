import { DateTime } from 'luxon'
import emitter from '@adonisjs/core/services/emitter'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import Order from '#models/order'
import OrderItem from '#models/order_item'
import type Organization from '#models/organization'
import type Quote from '#models/quote'
import OrderCancelled from '#events/order_cancelled'
import OrderConfirmed from '#events/order_confirmed'
import OrderCreated from '#events/order_created'
import OrderDelivered from '#events/order_delivered'
import OrderInProduction from '#events/order_in_production'
import OrderShipped from '#events/order_shipped'
import {
  OrderNotCreatableException,
  OrderNotFoundException,
  OrderTransitionException,
} from '#exceptions/order_errors'
import { ORDER_SIDE_ACTIONS, ORDER_TRANSITIONS } from '#shared/types/order'
import type { OrderAction, OrderAddress, OrderSide } from '#shared/types/order'

/** Violation de contrainte d'unicité Postgres (`23505`). */
const UNIQUE_VIOLATION = '23505'

type OrderEvent =
  OrderCreated | OrderConfirmed | OrderInProduction | OrderShipped | OrderDelivered | OrderCancelled

/**
 * Cycle de vie d'une commande (#6).
 *
 * ```
 * pending ──confirm──▶ confirmed ──startProduction──▶ in_production ──ship──▶ shipped ──deliver──▶ delivered
 *    └─────────cancel──────┴──▶ cancelled
 * ```
 *
 * La commande naît de l'acceptation d'un devis (`createFromQuote`, appelé par le
 * listener de `QuoteAccepted`). Le fournisseur la fait avancer jusqu'à
 * l'expédition, l'acheteur confirme la réception ; l'un et l'autre peuvent
 * l'annuler tant qu'elle n'est pas en production.
 *
 * Comme `QuoteService`, chaque transition est un `UPDATE … WHERE status IN (…)` :
 * la garde est en base, donc deux requêtes concurrentes ne s'écrasent pas.
 */
export default class OrderService {
  // ── Création ────────────────────────────────────────────────────────────

  /**
   * Crée la commande d'un devis accepté, avec ses lignes et des adresses
   * figées. **Idempotente** : `orders.quote_id` est unique, rejouer l'événement
   * (ou deux écouteurs simultanés) renvoie la commande existante sans en créer
   * une seconde ni ré-émettre `OrderCreated`.
   */
  async createFromQuote(quote: Quote): Promise<Order> {
    if (quote.status !== 'accepted') throw new OrderNotCreatableException()

    const existing = await Order.findBy('quoteId', quote.id)
    if (existing) return existing

    await quote.load('items', (items) => items.preload('rfqItem').orderBy('id'))
    await quote.load('rfq', (rfq) => rfq.preload('buyerOrganization'))
    const buyer = quote.rfq.buyerOrganization

    let order: Order
    try {
      order = await db.transaction(async (trx) => {
        const created = await Order.create(
          {
            quoteId: quote.id,
            buyerOrganizationId: buyer.id,
            supplierOrganizationId: quote.supplierOrganizationId,
            status: 'pending',
            // La demande ne porte pas d'adresse de livraison : on fige celle de
            // l'acheteur pour la livraison comme pour la facturation.
            shippingAddress: this.addressOf(buyer),
            billingAddress: this.addressOf(buyer),
            totalAmount: quote.totalAmount,
            currency: quote.currency,
          },
          { client: trx }
        )
        await OrderItem.createMany(
          quote.items.map((item) => ({
            orderId: created.id,
            quoteItemId: item.id,
            productId: item.productId,
            name: item.rfqItem.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            customizationDetails: item.customizationDetails,
          })),
          { client: trx }
        )
        return created
      })
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        return Order.findByOrFail('quoteId', quote.id)
      }
      throw error
    }

    await this.publish(new OrderCreated(order))
    return order
  }

  // ── Lecture ─────────────────────────────────────────────────────────────

  /** Commandes de l'organisation, de son côté (acheteur ou fournisseur), la plus récente en tête. */
  listFor(side: OrderSide, organizationId: number): Promise<Order[]> {
    return this.withDetail(Order.query())
      .where(this.ownerColumn(side), organizationId)
      .orderBy('createdAt', 'desc')
  }

  /**
   * Commande d'une organisation. L'appartenance fait partie du critère : la
   * commande d'une autre organisation est un 404, pas un 403.
   */
  async findFor(side: OrderSide, id: number, organizationId: number): Promise<Order> {
    const order = await this.withDetail(Order.query())
      .where('id', id)
      .where(this.ownerColumn(side), organizationId)
      .first()

    if (!order) throw new OrderNotFoundException()
    return order
  }

  /**
   * Commande liée à un devis de l'acheteur, s'il y en a une — l'écran du devis
   * accepté y renvoie.
   */
  findByQuoteFor(quoteId: number, buyerOrganizationId: number): Promise<Order | null> {
    return Order.query()
      .where('quoteId', quoteId)
      .where('buyerOrganizationId', buyerOrganizationId)
      .first()
  }

  // ── Transitions ─────────────────────────────────────────────────────────

  /**
   * Applique une action de statut au nom d'un côté. Refusée si l'action n'est
   * pas ouverte à ce côté, ou si la commande n'est plus dans un statut d'où elle
   * part. Renvoie la commande rafraîchie.
   */
  async transition(
    order: Order,
    action: OrderAction,
    side: OrderSide,
    now: DateTime = DateTime.now()
  ): Promise<Order> {
    if (!ORDER_SIDE_ACTIONS[side].includes(action)) throw new OrderTransitionException()

    const { from, to, timestamp } = ORDER_TRANSITIONS[action]
    const [updated] = await Order.query()
      .where('id', order.id)
      .whereIn('status', [...from])
      .update({ status: to, [timestamp]: now.toJSDate() })
    if (!Number(updated)) throw new OrderTransitionException()

    await order.refresh()
    await this.publish(this.eventFor(action, order, side))
    return order
  }

  /** Actions que `side` peut déclencher **maintenant** sur la commande. */
  availableActions(order: Order, side: OrderSide): OrderAction[] {
    return ORDER_SIDE_ACTIONS[side].filter((action) =>
      ORDER_TRANSITIONS[action].from.includes(order.status)
    )
  }

  // ── Interne ─────────────────────────────────────────────────────────────

  private eventFor(action: OrderAction, order: Order, side: OrderSide): OrderEvent {
    switch (action) {
      case 'confirm':
        return new OrderConfirmed(order)
      case 'startProduction':
        return new OrderInProduction(order)
      case 'ship':
        return new OrderShipped(order)
      case 'deliver':
        return new OrderDelivered(order)
      case 'cancel':
        return new OrderCancelled(order, side)
    }
  }

  private ownerColumn(side: OrderSide) {
    return side === 'buyer' ? 'buyerOrganizationId' : 'supplierOrganizationId'
  }

  /** Précharge ce que `OrderTransformer` affiche. */
  private withDetail(query: ModelQueryBuilderContract<typeof Order, Order>) {
    return query
      .preload('quote', (quote) => quote.preload('rfq'))
      .preload('buyerOrganization')
      .preload('supplierOrganization')
      .preload('items', (items) => items.orderBy('id'))
  }

  private addressOf(organization: Organization): OrderAddress {
    return {
      name: organization.name,
      line1: organization.addressLine1,
      line2: organization.addressLine2,
      postalCode: organization.postalCode,
      city: organization.city,
      country: organization.country,
    }
  }

  /**
   * Publie un événement **après** la transition : un listener défaillant ne doit
   * pas faire échouer une requête dont l'état est déjà écrit.
   */
  private async publish(event: OrderEvent): Promise<void> {
    try {
      await emitter.emit(event.constructor as never, event as never)
    } catch (error) {
      logger.error({ err: error, orderId: event.order.id }, 'order event listener failed')
    }
  }
}
