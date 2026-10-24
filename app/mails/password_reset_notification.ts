import LocalizedMail from '#mails/localized_mail'
import type { Locale } from '#shared/types/i18n'

/**
 * Mail de réinitialisation du mot de passe. `resetUrl` est déjà généré (URL
 * signée) par `PasswordResetService` — ce mail ne fait que l'afficher.
 */
export default class PasswordResetNotification extends LocalizedMail {
  constructor(
    private email: string,
    private resetUrl: string,
    private expiresInMinutes: number,
    locale: Locale
  ) {
    super(locale)
  }

  prepare() {
    this.message.to(this.email).subject(this.t('emails.passwordReset.subject'))
    this.htmlViewIn('emails/password_reset', {
      resetUrl: this.resetUrl,
      expiresInMinutes: this.expiresInMinutes,
    })
  }
}
