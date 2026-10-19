import logger from '@adonisjs/core/services/logger'
import mail from '@adonisjs/mail/services/main'
import env from '#start/env'
import type MailDeliveryFailed from '#events/mail_delivery_failed'
import MailDeliveryFailedAlert from '#mails/mail_delivery_failed_alert'

/**
 * Alerte sur un mail définitivement en échec : log `error` structuré, puis mail
 * à `MAIL_ALERT_ADDRESS` (s'il est défini). L'alerte part en direct
 * (`mail.send`), pas par la queue : elle ne doit pas dépendre du circuit qui
 * vient d'échouer ni boucler sur elle-même. Une erreur d'alerte est loguée,
 * jamais propagée.
 */
export default class OnMailDeliveryFailed {
  constructor(private alertAddress: string | undefined = env.get('MAIL_ALERT_ADDRESS')) {}

  async handle(event: MailDeliveryFailed) {
    const { delivery } = event
    logger.error(
      {
        idempotencyKey: delivery.idempotencyKey,
        kind: delivery.kind,
        to: delivery.to,
        attempts: delivery.attempts,
        error: delivery.error,
      },
      'mail delivery failed permanently'
    )

    const alertAddress = this.alertAddress
    if (!alertAddress) return

    try {
      await mail.send(new MailDeliveryFailedAlert(alertAddress, delivery))
    } catch (error) {
      logger.error({ err: error, idempotencyKey: delivery.idempotencyKey }, 'mail alert not sent')
    }
  }
}
