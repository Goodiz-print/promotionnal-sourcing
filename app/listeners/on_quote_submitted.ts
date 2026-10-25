import { inject } from '@adonisjs/core'
import QuoteNotificationService from '#services/quote_notification_service'
import type QuoteSubmitted from '#events/quote_submitted'

/**
 * Un fournisseur a remis un devis : prévient les responsables de l'acheteur. La
 * notification in-app suivra avec #57.
 */
@inject()
export default class OnQuoteSubmitted {
  constructor(private notifications: QuoteNotificationService) {}

  async handle({ quote }: QuoteSubmitted) {
    await quote.load('rfq')
    await quote.load('supplierOrganization')
    await this.notifications.notifySubmitted(quote)
  }
}
