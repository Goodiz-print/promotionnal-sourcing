import { DateTime } from 'luxon'
import type Organization from '#models/organization'
import OrganizationInvitation from '#models/organization_invitation'
import OrganizationUser from '#models/organization_user'
import Role from '#models/role'
import User from '#models/user'
import {
  AlreadyMemberException,
  InvitationNotPendingException,
  OrganizationInvitationNotFoundException,
} from '#exceptions/organization_errors'
import type { InviteMemberData } from '#shared/types/organization'

const INVITATION_TTL_DAYS = 7

/**
 * Invitations de membres par email. Aucun token stocké en base : le lien
 * envoyé s'appuie sur une URL signée AdonisJS (`signedUrlFor`/
 * `hasValidSignature`, cf. `InvitationAcceptanceController`) — cette table
 * ne sert qu'à l'état métier (liste, révocation, rôle proposé, expiration
 * affichée).
 */
export default class OrganizationInvitationsService {
  listPending(organizationId: number): Promise<OrganizationInvitation[]> {
    return OrganizationInvitation.query()
      .where('organizationId', organizationId)
      .where('status', 'pending')
      .preload('role')
      .orderBy('createdAt', 'desc')
  }

  /**
   * Charge une invitation par id (préchargée org/role/invitedBy), pour
   * l'écran public d'acceptation. 404 si l'id n'existe pas.
   */
  async findById(id: number): Promise<OrganizationInvitation> {
    const invitation = await OrganizationInvitation.query()
      .where('id', id)
      .preload('organization')
      .preload('role')
      .preload('invitedBy')
      .first()

    if (!invitation) throw new OrganizationInvitationNotFoundException()
    return invitation
  }

  /**
   * Crée une invitation, ou rafraîchit (rôle, expiration) une invitation en
   * attente existante pour le même email — évite les doublons en cas de
   * relance. Rejette si l'email appartient déjà à un membre de l'organisation.
   */
  async invite(
    organization: Organization,
    invitedBy: User,
    data: InviteMemberData
  ): Promise<OrganizationInvitation> {
    const existingUser = await User.query()
      .whereRaw('lower(email) = ?', [data.email.toLowerCase()])
      .first()

    if (existingUser) {
      const membership = await OrganizationUser.query()
        .where('organizationId', organization.id)
        .where('userId', existingUser.id)
        .first()
      if (membership) throw new AlreadyMemberException()
    }

    const role = await Role.findOrFail(data.roleId)

    const invitation =
      (await OrganizationInvitation.query()
        .where('organizationId', organization.id)
        .where('status', 'pending')
        .whereRaw('lower(email) = ?', [data.email.toLowerCase()])
        .first()) ?? new OrganizationInvitation()

    invitation.merge({
      organizationId: organization.id,
      email: data.email,
      roleId: role.id,
      invitedByUserId: invitedBy.id,
      status: 'pending',
      expiresAt: DateTime.now().plus({ days: INVITATION_TTL_DAYS }),
    })
    await invitation.save()
    await invitation.load('role')
    return invitation
  }

  /**
   * Renvoie une invitation en attente : prolonge son expiration d'un nouveau
   * TTL (le lien précédent, signé pour la même durée, reste valide jusqu'à son
   * échéance propre) et précharge `role`/`invitedBy` pour la composition du
   * mail. L'invitation reste rattachée à son auteur d'origine — renvoyer n'est
   * pas réinviter. Rejette toute invitation déjà acceptée ou révoquée.
   */
  async resend(invitation: OrganizationInvitation): Promise<OrganizationInvitation> {
    if (invitation.status !== 'pending') throw new InvitationNotPendingException()

    invitation.expiresAt = DateTime.now().plus({ days: INVITATION_TTL_DAYS })
    await invitation.save()
    await invitation.load('role')
    await invitation.load('invitedBy')
    return invitation
  }

  async revoke(invitation: OrganizationInvitation): Promise<void> {
    invitation.status = 'revoked'
    await invitation.save()
  }

  /**
   * Rattache l'utilisateur à l'organisation de l'invitation (idempotent :
   * ne duplique pas s'il est déjà membre), fixe son organisation courante si
   * absente, et marque l'invitation acceptée. Les vérifications d'éligibilité
   * (email correspondant, invitation en attente et non expirée) sont à la
   * charge de l'appelant (controller).
   */
  async accept(invitation: OrganizationInvitation, user: User): Promise<void> {
    const membership = await OrganizationUser.query()
      .where('organizationId', invitation.organizationId)
      .where('userId', user.id)
      .first()

    if (!membership) {
      await OrganizationUser.create({
        organizationId: invitation.organizationId,
        userId: user.id,
        roleId: invitation.roleId,
      })
    }

    if (!user.currentOrganizationId) {
      await user.merge({ currentOrganizationId: invitation.organizationId }).save()
    }

    invitation.status = 'accepted'
    await invitation.save()
  }
}
