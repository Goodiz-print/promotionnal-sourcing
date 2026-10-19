import { BaseMail } from '@adonisjs/mail'
import type { MailDeliveryFailure } from '#shared/types/mail'

/** Alerte interne : un mail transactionnel est en dead-letter. */
export default class MailDeliveryFailedAlert extends BaseMail {
  subject = 'Mail transactionnel en échec définitif'

  constructor(
    private email: string,
    private delivery: MailDeliveryFailure
  ) {
    super()
  }

  prepare() {
    this.message.to(this.email).htmlView('emails/mail_delivery_failed', {
      delivery: this.delivery,
    })
  }
}
