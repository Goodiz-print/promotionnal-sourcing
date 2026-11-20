import LocalizedMail from '#mails/localized_mail'
import type { Locale } from '#shared/types/i18n'
import type { RfqReminderMailData } from '#shared/types/mail'

/**
 * Relance d'un fournisseur qui n'a pas ouvert une demande de devis reçue
 * (`RfqNotificationService#remind`). Une seule relance par destinataire, dans sa
 * langue ; `rfqPath` est relatif, comme pour `RfqReceivedNotification`, et
 * `replyTo` est la même adresse relais que celle du mail de demande. Elle
 * reprend les mêmes lignes et prix indicatifs (#219), en HTML et en texte.
 * Comme lui, il reste anonyme pour un fournisseur non abonné (#220, #222).
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
    const { rfqTitle, buyerName, replyTo, subscribePath, ...rest } = this.data
    const introKey =
      buyerName === null ? 'emails.rfqReminder.anonymous.body' : 'emails.rfqReminder.body'
    this.message.to(this.email).subject(this.t('emails.rfqReminder.subject', { rfqTitle }))
    this.relayRepliesTo(replyTo)

    const state = {
      ...rest,
      rfqTitle,
      intro: this.t(introKey, { buyerName, rfqTitle }),
      subscribePath: buyerName === null ? (subscribePath ?? null) : null,
      description: rest.description ?? null,
      lines: rest.lines ?? [],
      canReply: Boolean(replyTo),
    }
    this.htmlViewIn('emails/rfq_reminder', state)
    this.textViewIn('emails/rfq_reminder_text', state)
  }
}
