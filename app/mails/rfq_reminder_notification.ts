import LocalizedMail from '#mails/localized_mail'
import type { Locale } from '#shared/types/i18n'
import type { RfqReminderMailData } from '#shared/types/mail'

/**
 * Relance d'un fournisseur qui n'a pas ouvert une demande de devis reçue
 * (`RfqNotificationService#remind`). Une seule relance par destinataire, dans sa
 * langue ; `rfqPath` est relatif, comme pour `RfqReceivedNotification`, et
 * `replyTo` est la même adresse relais que celle du mail de demande. Elle
 * reprend les mêmes lignes et prix indicatifs (#219), en HTML et en texte.
 */
export default class RfqReminderNotification extends LocalizedMail {
  constructor(
    private email: string,
    private data: RfqReminderMailData,
    locale: Locale
  ) {
    super(locale)
  }

  prepare() {
    const { rfqTitle, replyTo, ...rest } = this.data
    this.message.to(this.email).subject(this.t('emails.rfqReminder.subject', { rfqTitle }))
    this.relayRepliesTo(replyTo)

    const state = {
      ...rest,
      rfqTitle,
      description: rest.description ?? null,
      lines: rest.lines ?? [],
      canReply: Boolean(replyTo),
    }
    this.htmlViewIn('emails/rfq_reminder', state)
    this.textViewIn('emails/rfq_reminder_text', state)
  }
}
