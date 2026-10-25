import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import OrganizationUser from '#models/organization_user'
import NotificationService from '#services/notification_service'
import { RFQ_MANAGER_ROLES, RFQ_RESPONDER_ROLES } from '#shared/types/rfq'
import type Organization from '#models/organization'
import type Quote from '#models/quote'
import type Rfq from '#models/rfq'
import type RfqSupplier from '#models/rfq_supplier'
import type User from '#models/user'
import type { RoleSlug } from '#shared/types/role'
import type { NotificationData, NotificationType } from '#shared/types/notification'

/** Rôles qui voient arriver un nouveau membre dans leur organisation. */
const MEMBER_ADMIN_ROLES: readonly RoleSlug[] = ['owner', 'admin']

/**
 * Traduit les événements métier (demande diffusée, devis remis…) en
 * notifications in-app, pour les membres qui peuvent **agir** dessus. Mêmes
 * rôles que les mails correspondants : un `member`, qui n'a pas accès à l'écran,
 * n'est pas notifié d'une impasse.
 *
 * Un canal secondaire par nature : un échec est loggué sans être propagé, l'état
 * métier étant déjà écrit et visible sur l'écran concerné.
 */
@inject()
export default class InAppNotificationService {
  constructor(private notifications: NotificationService) {}

  /** Les responsables de chaque fournisseur destinataire reçoivent la demande. */
  async rfqSent(rfq: Rfq, buyer: Organization, recipients: RfqSupplier[]): Promise<number> {
    let created = 0
    for (const recipient of recipients) {
      created += await this.notifyMembers(
        recipient.supplierOrganizationId,
        RFQ_RESPONDER_ROLES,
        'rfq.received',
        { rfqId: rfq.id, rfqTitle: rfq.title, buyerName: buyer.name }
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

  /** Le fournisseur apprend la décision de l'acheteur. Suppose `quote.rfq` préchargé. */
  async quoteDecided(
    quote: Quote,
    type: Extract<NotificationType, 'quote.accepted' | 'quote.rejected'>,
    buyer: Organization
  ): Promise<number> {
    return this.notifyMembers(quote.supplierOrganizationId, RFQ_RESPONDER_ROLES, type, {
      quoteId: quote.id,
      rfqTitle: quote.rfq.title,
      buyerName: buyer.name,
    })
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
