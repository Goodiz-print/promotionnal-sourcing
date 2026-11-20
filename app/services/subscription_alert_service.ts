import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import Organization from '#models/organization'
import User from '#models/user'
import NotificationService from '#services/notification_service'
import type { DuplicateSubscriptionCancelled } from '#shared/types/subscription'

/**
 * Alertes de l'équipe plateforme sur les abonnements (cf. `docs/abonnements.md`) :
 * notification in-app à chaque administrateur (`platform_role = 'admin'`). Ne
 * lève jamais : l'alerte suit une action déjà faite chez Stripe, son échec est
 * loggé sans annuler quoi que ce soit.
 */
@inject()
export default class SubscriptionAlertService {
  constructor(private notifications: NotificationService) {}

  /**
   * Doublon résilié chez Stripe : son paiement est à rembourser depuis le
   * tableau de bord. Renvoie le nombre d'administrateurs prévenus.
   */
  async duplicateCancelled(duplicate: DuplicateSubscriptionCancelled): Promise<number> {
    try {
      const organization = await Organization.find(duplicate.organizationId)
      const admins = await User.query().where('platformRole', 'admin').select('id')
      for (const admin of admins) {
        await this.notifications.notify(admin, 'subscription.duplicate_cancelled', {
          organizationId: duplicate.organizationId,
          organizationName: organization?.name ?? `#${duplicate.organizationId}`,
          keptSubscriptionId: duplicate.keptSubscriptionId,
          cancelledSubscriptionId: duplicate.cancelledSubscriptionId,
        })
      }
      if (admins.length === 0) {
        logger.warn({ ...duplicate }, 'no platform admin to alert about a duplicate subscription')
      }
      return admins.length
    } catch (error) {
      logger.error({ err: error, ...duplicate }, 'duplicate subscription alert not sent')
      return 0
    }
  }
}
