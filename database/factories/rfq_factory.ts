import { DateTime } from 'luxon'
import factory from '@adonisjs/lucid/factories'
import Rfq from '#models/rfq'

/**
 * Demande de devis en brouillon. `buyerOrganizationId` reste à fournir par
 * l'appelant (`.merge({ buyerOrganizationId })`) : une demande n'a pas de sens
 * hors d'une organisation acheteuse.
 */
export const RfqFactory = factory
  .define(Rfq, async ({ faker }) => ({
    title: faker.commerce.productName(),
    status: 'draft' as const,
  }))
  .state('published', (rfq) => {
    rfq.status = 'published'
    rfq.publishedAt = DateTime.now()
  })
  .state('expired', (rfq) => {
    rfq.status = 'expired'
    rfq.publishedAt = DateTime.now().minus({ days: 10 })
    rfq.expiredAt = DateTime.now()
  })
  .build()
