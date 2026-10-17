import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { inject } from '@adonisjs/core'
import PlatformAdminService from '#services/platform_admin_service'
import { PlatformUserNotFoundException } from '#exceptions/admin_errors'

/**
 * Donne le rôle plateforme `admin` (accès au back-office `/admin`) à un compte
 * existant. Seul moyen d'en créer un en production : le rôle ne s'attribue
 * depuis aucun écran.
 */
export default class AdminGrant extends BaseCommand {
  static commandName = 'admin:grant'
  static description = "Donne le rôle d'admin plateforme à l'utilisateur dont l'email est donné"

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'Email du compte à promouvoir' })
  declare email: string

  @inject()
  async run(platformAdmin: PlatformAdminService) {
    try {
      const user = await platformAdmin.grant(this.email)
      this.logger.success(`${user.email} est désormais admin plateforme`)
    } catch (error) {
      if (!(error instanceof PlatformUserNotFoundException)) throw error
      this.logger.error(`Aucun utilisateur avec l'email ${this.email}`)
      this.exitCode = 1
    }
  }
}
