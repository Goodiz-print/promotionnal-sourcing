import LocalizedMail from '#mails/localized_mail'
import type User from '#models/user'
import type { Locale } from '#shared/types/i18n'

/**
 * Mail de bienvenue, dans la langue enregistrée sur le compte (`users.locale`).
 */
export default class WelcomeNotification extends LocalizedMail {
  from = 'noreply@promotionnal-sourcing.com'

  constructor(private user: User) {
    super(user.locale as Locale)
  }

  prepare() {
    this.message.to(this.user.email).subject(this.t('emails.welcome.subject'))
    this.htmlViewIn('emails/welcome', { user: this.user })
  }
}
