import LocalizedMail from '#mails/localized_mail'
import type { Locale } from '#shared/types/i18n'

/**
 * Prévient l'acheteur qu'un fournisseur vient de remettre un devis
 * (`QuoteNotificationService#notifySubmitted`). `quotePath` est relatif, comme
 * pour `RfqReceivedNotification` ; `total` arrive déjà formaté.
 */
export default class QuoteReceivedNotification extends LocalizedMail {
  constructor(
    private email: string,
    private supplierName: string,
    private rfqTitle: string,
    private total: string,
    private quotePath: string,
    locale: Locale
  ) {
    super(locale)
  }

  prepare() {
    this.message.to(this.email).subject(
      this.t('emails.quoteReceived.subject', {
        supplierName: this.supplierName,
        rfqTitle: this.rfqTitle,
      })
    )
    this.htmlViewIn('emails/quote_received', {
      supplierName: this.supplierName,
      rfqTitle: this.rfqTitle,
      total: this.total,
      quotePath: this.quotePath,
    })
  }
}
