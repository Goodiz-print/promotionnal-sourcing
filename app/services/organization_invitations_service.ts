import { DateTime } from 'luxon'
import { signedUrlFor } from '@adonisjs/core/services/url_builder'
import SendMailJob from '#jobs/send_mail_job'
import { mailSendKey } from '#shared/helpers/mail'
import { MAIL_KINDS } from '#shared/types/mail'
import type { Locale } from '#shared/types/i18n'
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
import type { InviteMemberData, PurgeInvitationsResult } from '#shared/types/organization'

const INVITATION_TTL_DAYS = 7

/**
 * Durée de conservation des invitations en état terminal (`expired`/`revoked`)
 * avant suppression définitive. Les invitations `accepted` ne sont jamais
 * supprimées : elles tracent l'origine d'une adhésion encore active.
 */
const TERMINAL_RETENTION_DAYS = 90

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

  /** Révoque une invitation **en attente** ; une invitation acceptée ou déjà close est rejetée. */
  async revoke(invitation: OrganizationInvitation): Promise<void> {
    if (invitation.status !== 'pending') throw new InvitationNotPendingException()

    invitation.status = 'revoked'
    await invitation.save()
  }

  /**
   * Met le mail d'invitation en **queue** (`SendMailJob`, table `queue_jobs`) et
   * non dans la file mémoire de `@adonisjs/mail` : un redémarrage du process ne
   * perd plus l'invitation, et un SMTP indisponible est rejoué. La charge ne
   * contient que des données déjà résolues (elle transite par la base).
   * L'invitation doit avoir son `role` préchargé.
   */
  async sendMail(
    invitation: OrganizationInvitation,
    organization: Organization,
    inviterName: string,
    locale: Locale
  ): Promise<void> {
    const acceptUrl = signedUrlFor(
      'organization.invitations.show',
      { locale, id: invitation.id },
      { expiresIn: `${INVITATION_TTL_DAYS}d`, purpose: 'organization-invitation' }
    )

    await SendMailJob.dispatch({
      kind: MAIL_KINDS.organizationInvitation,
      // Un renvoi est un nouvel envoi voulu : la clé ne dédoublonne que les rejeux.
      idempotencyKey: mailSendKey(MAIL_KINDS.organizationInvitation, {
        invitation: invitation.id,
      }),
      to: invitation.email,
      locale,
      data: {
        organizationName: organization.name,
        roleName: invitation.role.name,
        inviterName,
        acceptUrl,
      },
    })
  }

  /**
   * Purge planifiée (`PurgeExpiredInvitationsJob`) :
   *
   * 1. bascule en `expired` les invitations `pending` dont `expires_at` est
   *    dépassé — elles n'étaient déjà plus acceptables (le contrôleur vérifie
   *    l'échéance), mais restaient affichées comme en attente indéfiniment ;
   * 2. supprime les invitations en état terminal (`expired`/`revoked`) créées
   *    il y a plus de `TERMINAL_RETENTION_DAYS` jours.
   *
   * `now` est injectable pour les tests (aucune horloge figée dans le projet).
   */
  async purgeExpired(now: DateTime = DateTime.now()): Promise<PurgeInvitationsResult> {
    const outdated = await OrganizationInvitation.query()
      .select('id')
      .where('status', 'pending')
      .where('expiresAt', '<', now.toJSDate())

    if (outdated.length > 0) {
      await OrganizationInvitation.query()
        .whereIn(
          'id',
          outdated.map((invitation) => invitation.id)
        )
        .update({ status: 'expired', updated_at: now.toJSDate() })
    }

    const deleted = await OrganizationInvitation.query()
      .whereIn('status', ['expired', 'revoked'])
      .where('createdAt', '<', now.minus({ days: TERMINAL_RETENTION_DAYS }).toJSDate())
      .delete()

    return { expired: outdated.length, deleted: Number(deleted) }
  }

  /**
   * Rattache l'utilisateur à l'organisation de l'invitation (idempotent :
   * ne duplique pas s'il est déjà membre), **bascule toujours** son
   * organisation courante dessus, et marque l'invitation acceptée. Les
   * vérifications d'éligibilité (email correspondant, invitation en attente et
   * non expirée) sont à la charge de l'appelant (controller).
   *
   * La bascule est inconditionnelle : accepter une invitation, c'est vouloir
   * travailler sur cette organisation. Sans elle, un invité déjà membre
   * ailleurs resterait sur son organisation d'origine et l'invitation
   * semblerait sans effet — le sélecteur d'organisation n'apparaissant qu'à
   * partir de deux adhésions.
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

    await user.merge({ currentOrganizationId: invitation.organizationId }).save()

    invitation.status = 'accepted'
    await invitation.save()
  }
}
