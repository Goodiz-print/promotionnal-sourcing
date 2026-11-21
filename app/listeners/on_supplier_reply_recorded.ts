import { inject } from '@adonisjs/core'
import SupplierReplyNotificationService from '#services/supplier_reply_notification_service'
import type SupplierReplyRecorded from '#events/supplier_reply_recorded'

/**
 * Un fournisseur a répondu par mail (#224) : la réponse est transmise à
 * l'agence, par mail et par notification in-app (#225).
 */
@inject()
export default class OnSupplierReplyRecorded {
  constructor(private replies: SupplierReplyNotificationService) {}

  async handle({ reply }: SupplierReplyRecorded) {
    await this.replies.notify(reply)
  }
}
