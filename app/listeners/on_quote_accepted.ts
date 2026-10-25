import { inject } from '@adonisjs/core'
import InAppNotificationService from '#services/in_app_notification_service'
import type QuoteAccepted from '#events/quote_accepted'

/** L'acheteur a accepté un devis : le fournisseur en est prévenu. */
@inject()
export default class OnQuoteAccepted {
  constructor(private inApp: InAppNotificationService) {}

  async handle({ quote }: QuoteAccepted) {
    await quote.load('rfq', (rfq) => rfq.preload('buyerOrganization'))
    await this.inApp.quoteDecided(quote, 'quote.accepted', quote.rfq.buyerOrganization)
  }
}
