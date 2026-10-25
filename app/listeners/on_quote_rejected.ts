import { inject } from '@adonisjs/core'
import InAppNotificationService from '#services/in_app_notification_service'
import type QuoteRejected from '#events/quote_rejected'

/** L'acheteur a rejeté un devis : le fournisseur en est prévenu. */
@inject()
export default class OnQuoteRejected {
  constructor(private inApp: InAppNotificationService) {}

  async handle({ quote }: QuoteRejected) {
    await quote.load('rfq', (rfq) => rfq.preload('buyerOrganization'))
    await this.inApp.quoteDecided(quote, 'quote.rejected', quote.rfq.buyerOrganization)
  }
}
