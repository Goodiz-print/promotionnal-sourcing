import LocalizedMail from '#mails/localized_mail'
import type { Locale } from '#shared/types/i18n'

/**
 * Relance d'un fournisseur qui n'a pas ouvert une demande de devis reçue
 * (`RfqNotificationService#remind`). Une seule relance par destinataire, dans sa
 * langue ; `rfqPath` est relatif, comme pour `RfqReceivedNotification`, et
 * `replyTo` est la même adresse relais que celle du mail de demande.
 */
export default class RfqReminderNotification extends LocalizedMail {
  constructor(
    private email: string,
    private buyerName: string,
    private rfqTitle: string,
    private deadline: string | null,
    private rfqPath: string,
    locale: Locale,
    private relayAddress: string | null = null
  ) {
    super(locale)
  }

  prepare() {
    this.message
      .to(this.email)
      .subject(this.t('emails.rfqReminder.subject', { rfqTitle: this.rfqTitle }))
    this.relayRepliesTo(this.relayAddress)
    this.htmlViewIn('emails/rfq_reminder', {
      buyerName: this.buyerName,
      rfqTitle: this.rfqTitle,
      deadline: this.deadline,
      rfqPath: this.rfqPath,
    })
  }
}
