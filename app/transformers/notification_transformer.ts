import { BaseTransformer } from '@adonisjs/core/transformers'
import { urlFor } from '@adonisjs/core/services/url_builder'
import type Notification from '#models/notification'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import type {
  NotificationData,
  NotificationItemType,
  NotificationType,
} from '#shared/types/notification'

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
      href: notificationHref(this.resource.type, this.resource.data, this.locale),
    }
  }
}

/**
 * Écran où mène une notification (chemin relatif, dans la langue donnée) ;
 * retombe sur la liste si le contexte manque. Partagé par la cloche et le mail
 * de rappel (#243), qui le préfixe par `appUrl`.
 */
export function notificationHref(
  type: NotificationType,
  data: NotificationData,
  locale: Locale
): string {
  const { rfqId, quoteId, orderId, organizationId, side } = data

  switch (type) {
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
    case 'subscription.duplicate_cancelled':
      if (typeof organizationId === 'number') {
        return urlFor('admin.organizations.show', { locale, id: organizationId })
      }
      break
    case 'message.warned':
      // Pas d'écran de messagerie côté utilisateur pour l'instant : la liste fait foi.
      break
    default:
      break
  }
  return urlFor('notifications.index', { locale })
}
