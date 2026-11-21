import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import Notification from '#models/notification'
import OrganizationUser from '#models/organization_user'
import NotificationService from '#services/notification_service'
import SubscriptionService from '#services/subscription_service'
import { RFQ_MANAGER_ROLES, RFQ_RESPONDER_ROLES } from '#shared/types/rfq'
import type Order from '#models/order'
import type Organization from '#models/organization'
import type Quote from '#models/quote'
import type Rfq from '#models/rfq'
import type RfqSupplier from '#models/rfq_supplier'
import type User from '#models/user'
import type { OrderSide } from '#shared/types/order'
import type { RoleSlug } from '#shared/types/role'
import type { SupplierReplyNotice } from '#shared/types/supplier_reply'
import type {
  NotificationData,
  NotificationType,
  OrderNotificationType,
} from '#shared/types/notification'

/** Rôles qui voient arriver un nouveau membre dans leur organisation. */
const MEMBER_ADMIN_ROLES: readonly RoleSlug[] = ['owner', 'admin']

/**
 * Traduit les événements métier (demande diffusée, devis remis…) en
 * notifications in-app, pour les membres qui peuvent **agir** dessus. Mêmes
 * rôles que les mails correspondants : un `member`, qui n'a pas accès à l'écran,
 * n'est pas notifié d'une impasse.
 *
 * Une notification destinée à un fournisseur **non abonné** ne nomme pas
 * l'agence (#220) : `buyerName` est omis des données, lues telles quelles par la
 * cloche et le mail de rappel. L'abonnement est lu à la création.
 *
 * Un canal secondaire par nature : un échec est loggué sans être propagé, l'état
 * métier étant déjà écrit et visible sur l'écran concerné.
 */
@inject()
export default class InAppNotificationService {
  constructor(
    private notifications: NotificationService,
    private subscriptions: SubscriptionService
  ) {}

  /** Les responsables de chaque fournisseur destinataire reçoivent la demande. */
  async rfqSent(rfq: Rfq, buyer: Organization, recipients: RfqSupplier[]): Promise<number> {
    const subscribed = await this.subscriptions.subscribedAmong(
      recipients.map(({ supplierOrganizationId }) => supplierOrganizationId)
    )
    let created = 0
    for (const { supplierOrganizationId } of recipients) {
      created += await this.notifyMembers(
        supplierOrganizationId,
        RFQ_RESPONDER_ROLES,
        'rfq.received',
        {
          rfqId: rfq.id,
          rfqTitle: rfq.title,
          ...buyerNameFor(buyer, subscribed.has(supplierOrganizationId)),
        }
      )
    }
    return created
  }

  /** Les responsables de l'acheteur apprennent qu'un fournisseur a décliné. */
  async rfqDeclined(rfq: Rfq, supplier: Organization): Promise<number> {
    return this.notifyMembers(rfq.buyerOrganizationId, RFQ_MANAGER_ROLES, 'rfq.declined', {
      rfqId: rfq.id,
      rfqTitle: rfq.title,
      supplierName: supplier.name,
    })
  }

  /** Suppose `quote.rfq` et `quote.supplierOrganization` préchargés. */
  async quoteSubmitted(quote: Quote): Promise<number> {
    return this.notifyMembers(quote.rfq.buyerOrganizationId, RFQ_MANAGER_ROLES, 'quote.received', {
      quoteId: quote.id,
      rfqTitle: quote.rfq.title,
      supplierName: quote.supplierOrganization.name,
    })
  }

  /**
   * Le fournisseur apprend la décision de l'acheteur. Suppose `quote.rfq`
   * préchargé. Un refus reste anonyme pour un non abonné ; une acceptation
   * nomme l'agence, qui passe commande et se fait donc connaître.
   */
  async quoteDecided(
    quote: Quote,
    type: Extract<NotificationType, 'quote.accepted' | 'quote.rejected'>,
    buyer: Organization
  ): Promise<number> {
    const revealBuyer =
      type === 'quote.accepted' ||
      (await this.subscriptions.isSubscribed(quote.supplierOrganizationId))
    return this.notifyMembers(quote.supplierOrganizationId, RFQ_RESPONDER_ROLES, type, {
      quoteId: quote.id,
      rfqTitle: quote.rfq.title,
      ...buyerNameFor(buyer, revealBuyer),
    })
  }

  /**
   * Une commande a changé d'état : les responsables du côté `recipient` sont
   * prévenus. Charge ce qu'il faut de la commande (demande, deux organisations).
   * `side` part dans les données : il détermine l'écran que le lien ouvre.
   */
  async orderChanged(
    order: Order,
    type: OrderNotificationType,
    recipient: OrderSide
  ): Promise<number> {
    await order.load('quote', (quote) => quote.preload('rfq'))
    await order.load('buyerOrganization')
    await order.load('supplierOrganization')

    return this.notifyMembers(
      recipient === 'buyer' ? order.buyerOrganizationId : order.supplierOrganizationId,
      recipient === 'buyer' ? RFQ_MANAGER_ROLES : RFQ_RESPONDER_ROLES,
      type,
      {
        orderId: order.id,
        rfqTitle: order.quote.rfq.title,
        buyerName: order.buyerOrganization.name,
        supplierName: order.supplierOrganization.name,
        side: recipient,
      }
    )
  }

  /**
   * Un fournisseur a répondu par mail (#225) : les destinataires de la
   * transmission (auteur de la demande, responsables de l'agence) sont
   * prévenus. Le message du fil part dans les données : un événement rejoué ne
   * crée pas de seconde notification pour qui l'a déjà.
   */
  async supplierReplied(userIds: number[], notice: SupplierReplyNotice): Promise<number> {
    const data: NotificationData = {
      rfqId: notice.rfqId,
      rfqTitle: notice.rfqTitle,
      supplierName: notice.supplierName,
      messageId: notice.messageId,
    }
    try {
      const recipients = [...new Set(userIds)]
      const notified = await this.alreadyNotified(recipients, notice.messageId)
      const pending = recipients.filter((userId) => !notified.has(userId))
      const created = await Promise.all(pending.map((userId) => this.notifyOnce(userId, data)))
      return created.filter(Boolean).length
    } catch (error) {
      logger.warn({ err: error, rfqId: notice.rfqId }, 'failed to create in-app notifications')
      return 0
    }
  }

  /**
   * Parmi `userIds`, ceux déjà notifiés d'une réponse pour ce message du fil.
   * Bornée aux destinataires : l'index `(user_id, …)` sert la recherche.
   */
  private async alreadyNotified(userIds: number[], messageId: number): Promise<Set<number>> {
    if (userIds.length === 0) return new Set()
    const rows = await Notification.query()
      .whereIn('userId', userIds)
      .where('type', 'rfq.responded')
      .whereRaw(`data->>'messageId' = ?`, [String(messageId)])
      .select('userId')
    return new Set(rows.map((row) => row.userId))
  }

  /**
   * Crée la notification de réponse, sauf si un traitement concurrent vient de
   * la créer : l'index unique `(user_id, type, data->>'messageId')` tranche
   * (`NotificationService#notifyOnce`). Renvoie `true` si elle a été créée.
   */
  private async notifyOnce(userId: number, data: NotificationData): Promise<boolean> {
    const id = await this.notifications.notifyOnce({ id: userId }, 'rfq.responded', data)
    return id !== null
  }

  /** Les propriétaires et administrateurs voient arriver le nouveau membre. */
  async memberJoined(organization: Organization, user: User): Promise<number> {
    return this.notifyMembers(
      organization.id,
      MEMBER_ADMIN_ROLES,
      'organization.member_joined',
      { organizationName: organization.name, memberName: user.fullName ?? user.email },
      user.id
    )
  }

  /**
   * Une notification par utilisateur de l'organisation ayant l'un des rôles,
   * sauf `exceptUserId` (l'auteur de l'action). Renvoie le nombre créé.
   */
  private async notifyMembers(
    organizationId: number,
    roles: readonly RoleSlug[],
    type: NotificationType,
    data: NotificationData,
    exceptUserId?: number
  ): Promise<number> {
    try {
      const memberships = await OrganizationUser.query()
        .where('organizationId', organizationId)
        .whereHas('role', (role) => role.whereIn('slug', [...roles]))
        .if(exceptUserId, (query) => query.whereNot('userId', exceptUserId!))
        .select('userId')

      const userIds = [...new Set(memberships.map((membership) => membership.userId))]
      for (const userId of userIds) {
        await this.notifications.notify({ id: userId }, type, data)
      }
      return userIds.length
    } catch (error) {
      logger.warn({ err: error, organizationId, type }, 'failed to create in-app notifications')
      return 0
    }
  }
}

/** Le nom de l'agence dans les données, ou rien pour un fournisseur non abonné. */
function buyerNameFor(buyer: Organization, revealBuyer: boolean): NotificationData {
  return revealBuyer ? { buyerName: buyer.name } : {}
}
