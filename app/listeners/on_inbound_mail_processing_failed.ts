import logger from '@adonisjs/core/services/logger'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import env from '#start/env'
import type InboundMailProcessingFailed from '#events/inbound_mail_processing_failed'
import InboundMailFailedAlert from '#mails/inbound_mail_failed_alert'
import InboundMail from '#models/inbound_mail'
import { INBOUND_MAIL_STATUSES, type InboundMailFailureAlertData } from '#shared/types/inbound_mail'

/**
 * Alerte sur un mail entrant dont le traitement a échoué à chaque tentative
 * (#227), sur le modèle de `OnMailDeliveryFailed` : log `error` structuré, puis
 * mail à `MAIL_ALERT_ADDRESS` (s'il est défini), envoyé en direct.
 *
 * **Une alerte par mail** (`failure_alerted_at`) : la reprise planifiée rejoue
 * un mail en échec pendant 24 h, chaque reprise épuisant à nouveau ses
 * tentatives ; seule la première prévient. Une erreur d'alerte est loguée,
 * jamais propagée, et l'alerte pourra repartir au prochain échec.
 */
export default class OnInboundMailProcessingFailed {
  constructor(
    private alertAddress: string | undefined = env.get('MAIL_ALERT_ADDRESS'),
    private appUrl: string = env.get('APP_URL', 'http://localhost:5555')
  ) {}

  async handle({ failure }: InboundMailProcessingFailed) {
    logger.error(failure, 'inbound mail processing failed permanently')

    const alertAddress = this.alertAddress
    if (!alertAddress) return
    if (!(await this.claimAlert(failure.inboundMailId))) return

    try {
      const data = await this.alertData(failure.inboundMailId, failure.error)
      await mail.send(new InboundMailFailedAlert(alertAddress, data))
    } catch (error) {
      logger.error(
        { err: error, inboundMailId: failure.inboundMailId },
        'inbound mail alert not sent'
      )
      await this.releaseAlert(failure.inboundMailId)
    }
  }

  /** Bascule conditionnelle : vrai si aucune alerte n'est encore partie pour ce mail. */
  private async claimAlert(inboundMailId: number): Promise<boolean> {
    const claimed = await InboundMail.query()
      .where('id', inboundMailId)
      .whereNull('failure_alerted_at')
      .update({ failure_alerted_at: new Date() })
    return Number(claimed[0] ?? claimed) > 0
  }

  private async releaseAlert(inboundMailId: number): Promise<void> {
    await InboundMail.query().where('id', inboundMailId).update({ failure_alerted_at: null })
  }

  private async alertData(
    inboundMailId: number,
    error: string
  ): Promise<InboundMailFailureAlertData> {
    const failed = await InboundMail.query()
      .where('id', inboundMailId)
      .select('id', 'sender_address', 'recipient', 'subject', 'received_at')
      .firstOrFail()
    const recent = await InboundMail.query()
      .where('status', INBOUND_MAIL_STATUSES.failed)
      .where('received_at', '>', DateTime.now().minus({ hours: 24 }).toJSDate())
      .count('* as total')
      .first()

    return {
      inboundMailId,
      senderAddress: failed.senderAddress,
      recipient: failed.recipient,
      subject: failed.subject,
      error,
      receivedAt: failed.receivedAt.toISO()!,
      recentFailures: Math.max(Number(recent?.$extras.total ?? 0), 1),
      adminUrl: new URL(`/fr/admin/inbound-mail/${inboundMailId}`, this.appUrl).toString(),
    }
  }
}
