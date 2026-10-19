import User from '#models/user'
import { PlatformUserNotFoundException } from '#exceptions/admin_errors'
import type { PlatformRole } from '#shared/types/user'

/**
 * Attribution et retrait du rôle plateforme (commandes `admin:grant` /
 * `admin:revoke`). Idempotent : accorder à un admin ou retirer à un non-admin
 * est sans effet.
 */
export default class PlatformAdminService {
  grant(email: string): Promise<User> {
    return this.setRole(email, 'admin')
  }

  revoke(email: string): Promise<User> {
    return this.setRole(email, 'none')
  }

  private async setRole(email: string, platformRole: PlatformRole): Promise<User> {
    const user = await User.query()
      .whereRaw('lower(email) = ?', [email.trim().toLowerCase()])
      .first()
    if (!user) throw new PlatformUserNotFoundException()

    if (user.platformRole !== platformRole) {
      await user.merge({ platformRole }).save()
    }
    return user
  }
}
