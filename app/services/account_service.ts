import { randomBytes } from 'node:crypto'
import { inject } from '@adonisjs/core'
import hash from '@adonisjs/core/services/hash'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import OrganizationInvitation from '#models/organization_invitation'
import OrganizationUser from '#models/organization_user'
import type User from '#models/user'
import EmailVerificationService from '#services/email_verification_service'
import OrganizationMembersService from '#services/organization_members_service'
import {
  AccountOwnsOrganizationsException,
  InvalidCurrentPasswordException,
} from '#exceptions/account_errors'
import { DEFAULT_LOCALE } from '#shared/types/i18n'
import { ANONYMIZED_EMAIL_DOMAIN, type UpdateAccountData } from '#shared/types/account'

/**
 * Page « mon compte » : profil, mot de passe, suppression (RGPD).
 */
@inject()
export default class AccountService {
  constructor(
    private emailVerification: EmailVerificationService,
    private members: OrganizationMembersService
  ) {}

  /**
   * Met à jour nom, email et langue. Un changement d'adresse remet le compte en
   * « non vérifié » et envoie un nouveau mail de vérification à la **nouvelle**
   * adresse : l'utilisateur est renvoyé sur l'écran de vérification tant qu'il
   * n'a pas confirmé. Retourne `true` si l'adresse a changé.
   */
  async updateProfile(user: User, data: UpdateAccountData, locale: string): Promise<boolean> {
    const emailChanged = data.email.toLowerCase() !== user.email.toLowerCase()

    user.merge({ fullName: data.fullName, email: data.email, locale: data.locale })
    if (emailChanged) user.emailVerifiedAt = null
    await user.save()

    if (emailChanged) {
      // Même tolérance qu'à l'inscription : le mail est un rappel, l'écran de
      // vérification permet de le renvoyer.
      try {
        await this.emailVerification.send(user, locale)
      } catch (error) {
        logger.warn({ err: error, userId: user.id }, 'email verification mail could not be queued')
      }
    }

    return emailChanged
  }

  async updatePassword(user: User, currentPassword: string, newPassword: string): Promise<void> {
    await this.assertCurrentPassword(user, currentPassword)

    user.password = newPassword
    await user.save()
  }

  /**
   * Noms des organisations **non archivées** dont l'utilisateur est le dernier
   * owner : celles qui bloquent la suppression du compte (mêmes règles que
   * `OrganizationService#leave`, appliquées à toutes ses adhésions). Une
   * organisation archivée est hors service : elle ne retient personne.
   */
  async blockingOrganizations(user: User): Promise<string[]> {
    const memberships = await OrganizationUser.query()
      .where('userId', user.id)
      .whereHas('organization', (query) => query.whereNull('archivedAt'))
      .preload('organization')

    const names: string[] = []
    for (const membership of memberships) {
      if (await this.members.isLastOwner(membership)) names.push(membership.organization.name)
    }
    return names
  }

  /**
   * Supprime le compte par **anonymisation** plutôt que `DELETE` : des demandes
   * de devis (`created_by_user_id`) et des invitations référencent l'utilisateur,
   * et les effacer détruirait l'historique des autres organisations.
   *
   * La ligne `users` est conservée mais vidée de toute donnée personnelle :
   * email remplacé par une adresse `.invalid` unique, nom effacé, mot de passe
   * remplacé par un secret aléatoire inconnu de tous (connexion impossible), langue
   * remise par défaut (colonne `NOT NULL`),
   * adhésions supprimées, invitations en attente adressées à l'ancien email
   * supprimées. Refusée tant que l'utilisateur est dernier owner d'une
   * organisation active.
   */
  async destroy(user: User, currentPassword: string): Promise<void> {
    await this.assertCurrentPassword(user, currentPassword)

    const blocking = await this.blockingOrganizations(user)
    if (blocking.length > 0) throw new AccountOwnsOrganizationsException(blocking)

    const previousEmail = user.email

    await db.transaction(async (trx) => {
      await OrganizationUser.query({ client: trx }).where('userId', user.id).delete()
      await OrganizationInvitation.query({ client: trx })
        .whereRaw('lower(email) = ?', [previousEmail.toLowerCase()])
        .where('status', 'pending')
        .delete()

      user.useTransaction(trx)
      user.merge({
        email: `deleted-${user.id}@${ANONYMIZED_EMAIL_DOMAIN}`,
        fullName: null,
        password: randomBytes(32).toString('hex'),
        locale: DEFAULT_LOCALE,
        currentOrganizationId: null,
        emailVerifiedAt: null,
      })
      await user.save()
    })
  }

  private async assertCurrentPassword(user: User, candidate: string): Promise<void> {
    if (!(await hash.verify(user.password, candidate))) throw new InvalidCurrentPasswordException()
  }
}
