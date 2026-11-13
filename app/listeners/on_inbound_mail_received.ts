import { inject } from '@adonisjs/core'
import SupplierReplyService from '#services/supplier_reply_service'
import type InboundMailReceived from '#events/inbound_mail_received'

/**
 * Une réponse de fournisseur vient d'être reçue par mail : elle devient un
 * message du fil de la demande, et son PDF un devis (#224). Une erreur est
 * propagée : le mail repasse `failed` et son traitement est rejoué.
 */
@inject()
export default class OnInboundMailReceived {
  constructor(private replies: SupplierReplyService) {}

  async handle({ mail }: InboundMailReceived) {
    await this.replies.record(mail.inboundMailId)
  }
}
