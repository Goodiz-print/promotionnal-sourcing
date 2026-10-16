import { BaseMail } from '@adonisjs/mail'

/**
 * Mail de réinitialisation du mot de passe. `resetUrl` est déjà généré (URL
 * signée) par `PasswordResetService` — ce mail ne fait que l'afficher.
 */
export default class PasswordResetNotification extends BaseMail {
  subject = 'Réinitialisation de votre mot de passe'

  constructor(
    private email: string,
    private resetUrl: string,
    private expiresInMinutes: number
  ) {
    super()
  }

  prepare() {
    this.message.to(this.email).htmlView('emails/password_reset', {
      resetUrl: this.resetUrl,
      expiresInMinutes: this.expiresInMinutes,
    })
  }
}
