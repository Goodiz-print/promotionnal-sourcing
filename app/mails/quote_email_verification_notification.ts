import LocalizedMail from '#mails/localized_mail'
import type { Locale } from '#shared/types/i18n'
import type { QuoteEmailVerificationMailData } from '#shared/types/mail'

/**
 * Confirmation de l'adresse de réception des demandes de devis (#217), envoyée
 * à cette adresse. `verifyUrl` est déjà signé par
 * `QuoteEmailVerificationService` ; ce mail ne fait que l'afficher.
 */
export default class QuoteEmailVerificationNotification extends LocalizedMail {
  constructor(
    private email: string,
    private data: QuoteEmailVerificationMailData,
    locale: Locale
  ) {
    super(locale)
  }

  prepare() {
    const { organizationName } = this.data
    this.message
      .to(this.email)
      .subject(this.t('emails.quoteEmailVerification.subject', { organizationName }))
    this.htmlViewIn('emails/quote_email_verification', { ...this.data })
  }
}
