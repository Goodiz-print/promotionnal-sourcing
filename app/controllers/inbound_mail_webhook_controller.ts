import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import InboundMailService from '#services/inbound_mail_service'
import {
  InboundMailSignatureException,
  InboundMailUnavailableException,
} from '#exceptions/inbound_mail_errors'

/**
 * Webhook du prestataire de réception des mails (#223, `docs/mail.md`). Vraie
 * route d'API : hors locale, hors session, exemptée de CSRF — l'appelant est
 * authentifié par la **signature** de la requête, vérifiée sur le corps brut.
 *
 * Répond 200 dès que le mail est journalisé (y compris un doublon ou une
 * adresse inconnue) : le prestataire ne doit relancer que ce qui n'a pas été
 * enregistré. Toute autre erreur remonte en 500, donc en relance.
 */
@inject()
export default class InboundMailWebhookController {
  constructor(private inboundMails: InboundMailService) {}

  async store({ request, response }: HttpContext) {
    try {
      const receipt = await this.inboundMails.receive(request.raw() ?? '', request.headers())
      return response.ok({ received: true, receipt })
    } catch (error) {
      if (error instanceof InboundMailSignatureException) {
        logger.warn({ err: error }, 'inbound mail webhook rejected')
        return response.forbidden({ received: false })
      }
      if (error instanceof InboundMailUnavailableException) {
        return response.serviceUnavailable({ received: false })
      }
      throw error
    }
  }
}
