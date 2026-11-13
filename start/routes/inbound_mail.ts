import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

/**
 * Réception des mails entrants (cf. `docs/mail.md`) : hors locale et hors
 * session, exemptée de CSRF (`config/shield.ts`). Authentifiée par la signature
 * du prestataire.
 */
export function registerInboundMailWebhookRoutes(): void {
  router
    .post('webhooks/inbound-mail', [controllers.InboundMailWebhook, 'store'])
    .as('webhooks.inbound_mail')
}
