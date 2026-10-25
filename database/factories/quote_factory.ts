import { DateTime } from 'luxon'
import factory from '@adonisjs/lucid/factories'
import Quote from '#models/quote'

/**
 * Devis en brouillon. `rfqId` et `supplierOrganizationId` restent à fournir par
 * l'appelant ; `totalAmount` est à 0 tant qu'aucune ligne n'est chiffrée.
 */
export const QuoteFactory = factory
  .define(Quote, async () => ({
    status: 'draft' as const,
    currency: 'EUR',
    totalAmount: '0',
  }))
  .state('submitted', (quote) => {
    quote.status = 'submitted'
    quote.submittedAt = DateTime.now()
  })
  .build()
