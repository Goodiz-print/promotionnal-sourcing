import { BaseMail } from '@adonisjs/mail'
import type { HealthAlertEvent } from '#shared/types/admin_health'

/** Alerte interne : un composant de la plateforme se dégrade ou se rétablit. */
export default class PlatformHealthAlert extends BaseMail {
  subject: string

  constructor(
    private email: string,
    private events: HealthAlertEvent[]
  ) {
    super()
    const recovered = events.every((event) => event.status === 'ok')
    this.subject = recovered
      ? 'Plateforme : composant rétabli'
      : 'Plateforme : composant dégradé ou en panne'
  }

  prepare() {
    this.message.to(this.email).htmlView('emails/platform_health_alert', {
      events: this.events,
    })
  }
}
