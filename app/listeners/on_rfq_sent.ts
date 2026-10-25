import { inject } from '@adonisjs/core'
import InAppNotificationService from '#services/in_app_notification_service'
import RfqNotificationService from '#services/rfq_notification_service'
import type RfqSent from '#events/rfq_sent'

/**
 * Une demande vient d'être diffusée : chaque fournisseur destinataire reçoit un
 * mail et une notification in-app. Deux canaux indépendants — l'échec de l'un ne
 * prive pas l'autre (chacun logue ses erreurs sans les propager).
 */
@inject()
export default class OnRfqSent {
  constructor(
    private mails: RfqNotificationService,
    private inApp: InAppNotificationService
  ) {}

  async handle({ rfq, buyer, recipients }: RfqSent) {
    await this.mails.notifyRecipients(rfq, buyer, recipients)
    await this.inApp.rfqSent(rfq, buyer, recipients)
  }
}
