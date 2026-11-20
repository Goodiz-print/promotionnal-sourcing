import { DateTime } from 'luxon'
import factory from '@adonisjs/lucid/factories'
import OrganizationSubscription from '#models/organization_subscription'

/**
 * Abonnement fournisseur saisi à la main, **en cours** par défaut (Business,
 * commencé hier, fini dans un mois). `organizationId` est à fournir par
 * l'appelant. État `expired` : terminé, l'organisation n'est plus abonnée.
 */
export const OrganizationSubscriptionFactory = factory
  .define(OrganizationSubscription, async () => ({
    plan: 'business' as const,
    status: 'active' as const,
    origin: 'manual' as const,
    startsAt: DateTime.now().minus({ days: 1 }),
    endsAt: DateTime.now().plus({ months: 1 }),
    cancelAtPeriodEnd: false,
  }))
  .state('expired', (subscription) => {
    subscription.status = 'expired'
    subscription.startsAt = DateTime.now().minus({ months: 2 })
    subscription.endsAt = DateTime.now().minus({ months: 1 })
  })
  .build()
