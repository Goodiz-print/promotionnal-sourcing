import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import AccountService from '#services/account_service'
import AdminAuditService from '#services/admin_audit_service'
import AdminUserService from '#services/admin_user_service'
import EmailVerificationService from '#services/email_verification_service'
import PasswordResetService from '#services/password_reset_service'
import User from '#models/user'
import { AdminUserNotFoundException } from '#exceptions/admin_errors'
import {
  CannotActOnSelfException,
  CannotActOnPlatformAdminException,
  UserAlreadySuspendedException,
  UserNotSuspendedException,
  UserAlreadyVerifiedException,
  UserOwnsOrganizationsException,
} from '#exceptions/admin_user_errors'
import type { AdminActionContext } from '#shared/types/admin_audit'

interface ActionOptions {
  context: AdminActionContext
}

interface SuspendOptions extends ActionOptions {
  reason?: string
}

interface ResendVerificationOptions extends ActionOptions {
  locale: string
}

interface PasswordResetOptions extends ActionOptions {
  locale: string
}

/**
 * Actions d'administration sur les comptes utilisateurs (#160) : suspension,
 * réactivation, renvoi de vérification, reset de mot de passe, suppression RGPD.
 * Chaque action est auditée **dans la même transaction**.
 */
@inject()
export default class AdminUserActionService {
  constructor(
    private users: AdminUserService,
    private audit: AdminAuditService,
    private emailVerification: EmailVerificationService,
    private passwordReset: PasswordResetService,
    private account: AccountService
  ) {}

  /**
   * Suspend un compte. Un compte suspendu ne peut plus se connecter et sa
   * session existante sera invalidée au prochain accès (via le middleware).
   * Idempotence : suspendre un compte déjà suspendu renvoie 409.
   */
  async suspend(userId: number, options: SuspendOptions): Promise<User> {
    const user = await this.findOrFail(userId)
    this.assertNotSelf(user, options.context)
    this.assertNotPlatformAdmin(user)

    if (user.suspendedAt) throw new UserAlreadySuspendedException()

    await db.transaction(async (trx) => {
      user.useTransaction(trx)
      user.suspendedAt = DateTime.now()
      await user.save()

      await this.audit.record(
        {
          action: 'user.suspended',
          targetType: 'user',
          targetId: user.id,
          changes: {
            after: {
              suspended: true,
              ...(options.reason ? { reason: options.reason } : {}),
            },
          },
        },
        { ...options.context, client: trx }
      )
    })

    return user
  }

  /**
   * Réactive un compte suspendu.
   * Idempotence : réactiver un compte actif renvoie 409.
   */
  async reactivate(userId: number, options: ActionOptions): Promise<User> {
    const user = await this.findOrFail(userId)

    if (!user.suspendedAt) throw new UserNotSuspendedException()

    await db.transaction(async (trx) => {
      user.useTransaction(trx)
      user.suspendedAt = null
      await user.save()

      await this.audit.record(
        {
          action: 'user.reactivated',
          targetType: 'user',
          targetId: user.id,
          changes: { after: { suspended: false } },
        },
        { ...options.context, client: trx }
      )
    })

    return user
  }

  /**
   * Renvoie le mail de vérification d'email.
   * Idempotence : renvoyer à un compte déjà vérifié renvoie 409.
   *
   * Note : la clé d'idempotence du mail inclut un UUID, donc chaque appel
   * admin génère bien un nouvel envoi (contrairement au renvoi utilisateur
   * qui est limité par le throttle).
   */
  async resendVerification(userId: number, options: ResendVerificationOptions): Promise<User> {
    const user = await this.findOrFail(userId)

    if (user.emailVerifiedAt) throw new UserAlreadyVerifiedException()

    await db.transaction(async (trx) => {
      await this.audit.record(
        {
          action: 'user.verification_resent',
          targetType: 'user',
          targetId: user.id,
          changes: { after: { email: user.email } },
        },
        { ...options.context, client: trx }
      )
    })

    // Mail envoyé après le commit de l'audit (effets de bord asynchrones).
    await this.emailVerification.send(user, options.locale)

    return user
  }

  /**
   * Déclenche un reset de mot de passe pour un utilisateur.
   * Ne révèle pas si le compte existe (comme la demande utilisateur).
   */
  async requestPasswordReset(userId: number, options: PasswordResetOptions): Promise<User> {
    const user = await this.findOrFail(userId)

    await db.transaction(async (trx) => {
      await this.audit.record(
        {
          action: 'user.password_reset_requested',
          targetType: 'user',
          targetId: user.id,
          // On ne log pas l'email pour ne pas stocker de PII inutile
          changes: {},
        },
        { ...options.context, client: trx }
      )
    })

    // Mail envoyé après le commit de l'audit.
    await this.passwordReset.request(user.email, options.locale)

    return user
  }

  /**
   * Supprime un compte par **anonymisation** (RGPD). Refusée si l'utilisateur
   * est dernier owner d'une organisation active.
   *
   * L'audit est écrit **avant** l'anonymisation avec l'email d'origine, mais
   * le `targetId` suffit à retrouver le compte anonymisé. L'email n'est pas
   * stocké en clair dans `changes` (PII).
   */
  async destroy(userId: number, options: ActionOptions): Promise<void> {
    const user = await this.findOrFail(userId)
    this.assertNotSelf(user, options.context)
    this.assertNotPlatformAdmin(user)

    const blocking = await this.account.blockingOrganizations(user)
    if (blocking.length > 0) throw new UserOwnsOrganizationsException(blocking)

    await db.transaction(async (trx) => {
      // Audit dans la même transaction que l'anonymisation. Aucune donnée
      // personnelle n'y figure : la cible suffit à retrouver le compte.
      await this.audit.record(
        {
          action: 'user.deleted',
          targetType: 'user',
          targetId: user.id,
          changes: { after: { anonymized: true } },
        },
        { ...options.context, client: trx }
      )
      await this.account.anonymize(user, trx)
    })
  }

  private async findOrFail(id: number): Promise<User> {
    const user = await this.users.find(id)
    if (!user) throw new AdminUserNotFoundException()
    return user
  }

  private assertNotSelf(user: User, context: AdminActionContext): void {
    if (context.actor?.id === user.id) throw new CannotActOnSelfException()
  }

  private assertNotPlatformAdmin(user: User): void {
    if (user.platformRole === 'admin') throw new CannotActOnPlatformAdminException()
  }
}
