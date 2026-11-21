import { inject } from '@adonisjs/core'
import AgencyReplyService from '#services/agency_reply_service'
import SupplierReplyService from '#services/supplier_reply_service'
import type InboundMailReceived from '#events/inbound_mail_received'

/**
 * Un mail vient d'être reçu à une adresse relais. Selon le côté qui l'a écrit
 * (#226) :
 *
 *  - le **fournisseur** (`rfq-`) : sa réponse devient un message du fil, et son
 *    PDF un devis (#224) ;
 *  - l'**agence** (`agency-`) : son mail devient un message du fil, relayé au
 *    fournisseur.
 *
 * Une erreur est propagée : le mail repasse `failed` et son traitement est rejoué.
 */
@inject()
export default class OnInboundMailReceived {
  constructor(
    private supplierReplies: SupplierReplyService,
    private agencyReplies: AgencyReplyService
  ) {}

  async handle({ mail }: InboundMailReceived) {
    if (mail.side === 'agency') {
      await this.agencyReplies.record(mail.inboundMailId)
      return
    }
    await this.supplierReplies.record(mail.inboundMailId)
  }
}
