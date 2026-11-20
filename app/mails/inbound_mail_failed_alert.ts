import { BaseMail } from '@adonisjs/mail'
import type { InboundMailFailureAlertData } from '#shared/types/inbound_mail'

/** Alerte interne : le traitement d'un mail entrant a épuisé ses tentatives (#227). */
export default class InboundMailFailedAlert extends BaseMail {
  subject = 'Mail entrant en échec définitif'

  constructor(
    private email: string,
    private failure: InboundMailFailureAlertData
  ) {
    super()
  }

  prepare() {
    this.message.to(this.email).htmlView('emails/inbound_mail_failed', {
      failure: this.failure,
    })
  }
}
