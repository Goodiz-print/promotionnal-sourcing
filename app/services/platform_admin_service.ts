import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import AdminAuditService from '#services/admin_audit_service'
import {
  CannotChangeOwnPlatformRoleException,
  PlatformUserNotFoundException,
} from '#exceptions/admin_errors'
import type { AdminActionContext } from '#shared/types/admin_audit'
import type { PlatformRole } from '#shared/types/user'

/**
 * Attribution et retrait des rôles plateforme : depuis l'écran Utilisateurs du
 * back-office (`changeRole`) et par les commandes `admin:grant` / `admin:revoke`
 * (`grant` / `revoke`). Idempotent : réattribuer le rôle déjà porté est sans
 * effet et ne laisse aucune trace. Tout changement effectif est inscrit au
 * journal d'audit, dans la même transaction.
 */
@inject()
export default class PlatformAdminService {
  constructor(private audit: AdminAuditService) {}

  /** Commande ace : pas d'acteur ni d'IP, l'origine est consignée dans l'audit. */
  grant(email: string): Promise<User> {
    return this.setRoleByEmail(email, 'admin')
  }

  /** Commande ace : pas d'acteur ni d'IP, l'origine est consignée dans l'audit. */
  revoke(email: string): Promise<User> {
    return this.setRoleByEmail(email, 'none')
  }

  /**
   * Changement de rôle depuis le back-office. Un admin ne modifie jamais son
   * propre rôle : cela évite de se retirer l'accès par erreur.
   */
  async changeRole(
    target: User,
    platformRole: PlatformRole,
    context: AdminActionContext
  ): Promise<User> {
    if (context.actor?.id === target.id) throw new CannotChangeOwnPlatformRoleException()
    return this.apply(target, platformRole, context, false)
  }

  private async setRoleByEmail(email: string, platformRole: PlatformRole): Promise<User> {
    const user = await User.query()
      .whereRaw('lower(email) = ?', [email.trim().toLowerCase()])
      .first()
    if (!user) throw new PlatformUserNotFoundException()

    return this.apply(user, platformRole, { actor: null, ip: null }, true)
  }

  private async apply(
    user: User,
    platformRole: PlatformRole,
    context: AdminActionContext,
    viaCli: boolean
  ): Promise<User> {
    const previous = user.platformRole
    if (previous === platformRole) return user

    await db.transaction(async (trx) => {
      await user.useTransaction(trx).merge({ platformRole }).save()
      await this.audit.record(
        {
          action: 'platform_role.changed',
          targetType: 'user',
          targetId: user.id,
          changes: {
            before: { platformRole: previous },
            after: { platformRole },
            ...(viaCli ? { source: 'cli' as const } : {}),
          },
        },
        { ...context, client: trx }
      )
    })
    return user
  }
}
