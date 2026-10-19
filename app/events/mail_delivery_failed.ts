import type { MailDeliveryFailure } from '#shared/types/mail'

/** Un mail transactionnel a épuisé ses tentatives (dead-letter `mail_deliveries`). */
export default class MailDeliveryFailed {
  constructor(public delivery: MailDeliveryFailure) {}
}
