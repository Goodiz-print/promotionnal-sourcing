import factory from '@adonisjs/lucid/factories'
import AgencyProfile from '#models/agency_profile'

/**
 * Profil d'agence minimal (seule l'activité est obligatoire). `organizationId`
 * est à fournir par l'appelant.
 */
export const AgencyProfileFactory = factory
  .define(AgencyProfile, () => ({
    activity: 'object_communication_agency' as const,
  }))
  .build()
