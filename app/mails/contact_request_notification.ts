import { BaseMail } from '@adonisjs/mail'
import type { ContactRequestType } from '#shared/types/marketing'
import type { ContactRequestMailData } from '#shared/types/mail'

const TYPE_LABELS: Record<ContactRequestType, string> = {
  contact: 'Contact',
  partnership: 'Partenariat',
}

/**
 * Demande reçue par le formulaire de contact de la landing, à destination de
 * l'équipe (contact@ ou partners@). Mail interne : rédigé en français, comme
 * `MailDeliveryFailedAlert`, et `reply-to` posé sur le visiteur pour répondre
 * directement.
 */
export default class ContactRequestNotification extends BaseMail {
  constructor(
    private to: string,
    private request: ContactRequestMailData
  ) {
    super()
  }

  prepare() {
    const { type, company, email, name } = this.request
    this.message
      .to(this.to)
      .replyTo(email, name)
      .subject(
        `[Site] Demande ${type === 'partnership' ? 'de partenariat' : 'de contact'} — ${company}`
      )
    this.message.htmlView('emails/contact_request', {
      request: this.request,
      typeLabel: TYPE_LABELS[type],
    })
  }
}
