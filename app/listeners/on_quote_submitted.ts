import { inject } from '@adonisjs/core'
import InAppNotificationService from '#services/in_app_notification_service'
import QuoteNotificationService from '#services/quote_notification_service'
import type QuoteSubmitted from '#events/quote_submitted'

/**
 * Un fournisseur a remis un devis : prévient les responsables de l'acheteur, par
 * mail et par notification in-app.
 */
@inject()
export default class OnQuoteSubmitted {
  constructor(
    private notifications: QuoteNotificationService,
    private inApp: InAppNotificationService
  ) {}

  async handle({ quote }: QuoteSubmitted) {
    await quote.load('rfq')
    await quote.load('supplierOrganization')
    await this.notifications.notifySubmitted(quote)
    await this.inApp.quoteSubmitted(quote)
  }
}
