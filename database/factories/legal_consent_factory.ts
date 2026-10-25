import { DateTime } from 'luxon'
import factory from '@adonisjs/lucid/factories'
import LegalConsent from '#models/legal_consent'

/**
 * Consentement horodaté. `organizationId` est à fournir par l'appelant.
 */
export const LegalConsentFactory = factory
  .define(LegalConsent, () => ({
    kind: 'terms' as const,
    version: '2026-10-19',
    ipAddress: '203.0.113.7',
    acceptedAt: DateTime.now(),
  }))
  .build()
