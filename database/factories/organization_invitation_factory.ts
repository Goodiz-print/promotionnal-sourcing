import { DateTime } from 'luxon'
import factory from '@adonisjs/lucid/factories'
import OrganizationInvitation from '#models/organization_invitation'
import Role from '#models/role'

/**
 * Invitation en attente, valide 7 jours (le TTL de
 * `OrganizationInvitationsService`). `organizationId` reste à fournir par
 * l'appelant : une invitation n'a pas de sens hors d'une organisation.
 *
 * Le rôle par défaut est `member` — la table des rôles doit donc être semée
 * (`useDatabase` s'en charge).
 */
export const OrganizationInvitationFactory = factory
  .define(OrganizationInvitation, async ({ faker }) => {
    const role = await Role.findByOrFail('slug', 'member')
    return {
      email: faker.internet.email().toLowerCase(),
      roleId: role.id,
      status: 'pending' as const,
      expiresAt: DateTime.now().plus({ days: 7 }),
    }
  })
  .state('accepted', (invitation) => {
    invitation.status = 'accepted'
  })
  .state('revoked', (invitation) => {
    invitation.status = 'revoked'
  })
  .state('expired', (invitation) => {
    invitation.expiresAt = DateTime.now().minus({ days: 1 })
  })
  .build()
