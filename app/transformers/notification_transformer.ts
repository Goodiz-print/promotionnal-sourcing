import { BaseTransformer } from '@adonisjs/core/transformers'
import { urlFor } from '@adonisjs/core/services/url_builder'
import type Notification from '#models/notification'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import type { NotificationItemType } from '#shared/types/notification'

/**
 * Notification affichée dans la cloche et sur `/notifications`. Le lien est
 * résolu ici, dans la langue de l'utilisateur, d'après le type et le contexte
 * (`data`) : le client ne connaît aucune route.
 */
export default class NotificationTransformer extends BaseTransformer<Notification> {
  constructor(
    resource: Notification,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject(): NotificationItemType {
    return {
      id: this.resource.id,
      type: this.resource.type,
      data: this.resource.data,
      readAt: this.resource.readAt?.toISO() ?? null,
      createdAt: this.resource.createdAt.toISO()!,
      href: this.href(),
    }
  }

  /** Écran où la notification mène ; retombe sur la liste si le contexte manque. */
  private href(): string {
    const { locale } = this
    const { rfqId, quoteId, orderId, side } = this.resource.data

    switch (this.resource.type) {
      case 'rfq.received':
        if (typeof rfqId === 'number') return urlFor('supplier.rfqs.show', { locale, id: rfqId })
        break
      case 'rfq.declined':
      case 'rfq.responded':
        if (typeof rfqId === 'number') return urlFor('rfqs.show', { locale, id: rfqId })
        break
      case 'quote.received':
        if (typeof quoteId === 'number') return urlFor('quotes.show', { locale, id: quoteId })
        break
      case 'quote.accepted':
      case 'quote.rejected':
        if (typeof quoteId === 'number') {
          return urlFor('supplier.quotes.show', { locale, id: quoteId })
        }
        break
      case 'order.created':
      case 'order.confirmed':
      case 'order.in_production':
      case 'order.shipped':
      case 'order.delivered':
      case 'order.cancelled':
        // `side` : le côté du destinataire, qui détermine l'écran de la commande.
        if (typeof orderId === 'number') {
          return urlFor(side === 'supplier' ? 'supplier.orders.show' : 'orders.show', {
            locale,
            id: orderId,
          })
        }
        break
      case 'organization.member_joined':
        return urlFor('organization.members', { locale })
      default:
        break
    }
    return urlFor('notifications.index', { locale })
  }
}
