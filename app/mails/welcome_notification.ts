import { BaseMail } from '@adonisjs/mail'
import type User from '#models/user'

export default class WelcomeNotification extends BaseMail {
  from = 'noreply@promotionnal-sourcing.com'
  subject = 'Bienvenue sur Promotionnal Sourcing'

  constructor(private user: User) {
    super()
  }

  prepare() {
    this.message.to(this.user.email).htmlView('emails/welcome', { user: this.user })
  }
}
