import { BaseMail } from '@adonisjs/mail'

/**
 * Mail de vérification d'adresse. `verifyUrl` est déjà généré (URL signée) par
 * `EmailVerificationService` — ce mail ne fait que l'afficher.
 */
export default class EmailVerificationNotification extends BaseMail {
  subject = 'Confirmez votre adresse e-mail'

  constructor(
    private email: string,
    private verifyUrl: string,
    private expiresInHours: number
  ) {
    super()
  }

  prepare() {
    this.message.to(this.email).htmlView('emails/email_verification', {
      verifyUrl: this.verifyUrl,
      expiresInHours: this.expiresInHours,
    })
  }
}
