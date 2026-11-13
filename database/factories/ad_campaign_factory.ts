import { DateTime } from 'luxon'
import factory from '@adonisjs/lucid/factories'
import AdCampaign from '#models/ad_campaign'
import type { AdCampaignStatus } from '#shared/types/ads'

/**
 * Campagne de sponsorisation de test. `organizationId` et `productId` sont
 * obligatoires (NOT NULL) : les passer par `.merge({ organizationId, productId })`.
 * Par défaut : active depuis hier, sans fin, enchère 0,50 €, budget 20 €/jour.
 * Une campagne ne diffuse que si le portefeuille de l'organisation est crédité
 * (`AdWalletService.apply`).
 */
export const AdCampaignFactory = factory
  .define(AdCampaign, () => ({
    status: 'active' as AdCampaignStatus,
    maxCpcCents: 50,
    dailyBudgetCents: 2000,
    startsOn: DateTime.now().minus({ days: 1 }),
    endsOn: null,
  }))
  .state('paused', (campaign) => {
    campaign.status = 'paused'
  })
  .state('suspended', (campaign) => {
    campaign.status = 'suspended'
  })
  .build()
