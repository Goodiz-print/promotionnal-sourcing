import { DateTime } from 'luxon'
import User from '#models/user'

/**
 * Enregistre la date de dernière connexion d'un utilisateur.
 * Appelé après une connexion réussie (mot de passe ou passkey).
 */
export default class LoginService {
  /**
   * Écrit `last_login_at` seul : la connexion n'est pas une modification du
   * profil, `updated_at` et les hooks de sauvegarde ne sont pas touchés.
   */
  async recordLogin(user: User): Promise<void> {
    const now = DateTime.now()
    await User.query().where('id', user.id).update({ lastLoginAt: now.toSQL() })
    user.lastLoginAt = now
  }
}
