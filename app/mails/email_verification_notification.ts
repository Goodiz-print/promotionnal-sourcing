import LocalizedMail from '#mails/localized_mail'
import type { Locale } from '#shared/types/i18n'

/**
 * Mail de vérification d'adresse. `verifyUrl` est déjà généré (URL signée) par
 * `EmailVerificationService` — ce mail ne fait que l'afficher.
 */
export default class EmailVerificationNotification extends LocalizedMail {
  constructor(
    private email: string,
    private verifyUrl: string,
    private expiresInHours: number,
    locale: Locale
  ) {
    super(locale)
  }

  prepare() {
    this.message.to(this.email).subject(this.t('emails.emailVerification.subject'))
    this.htmlViewIn('emails/email_verification', {
      verifyUrl: this.verifyUrl,
      expiresInHours: this.expiresInHours,
    })
  }
}
