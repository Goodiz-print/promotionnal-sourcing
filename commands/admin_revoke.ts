import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { inject } from '@adonisjs/core'
import PlatformAdminService from '#services/platform_admin_service'
import { PlatformUserNotFoundException } from '#exceptions/admin_errors'

/**
 * Retire le rôle plateforme `admin` à un compte (il garde ses organisations).
 */
export default class AdminRevoke extends BaseCommand {
  static commandName = 'admin:revoke'
  static description = "Retire le rôle d'admin plateforme à l'utilisateur dont l'email est donné"

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'Email du compte à rétrograder' })
  declare email: string

  @inject()
  async run(platformAdmin: PlatformAdminService) {
    try {
      const user = await platformAdmin.revoke(this.email)
      this.logger.success(`${user.email} n'est plus admin plateforme`)
    } catch (error) {
      if (!(error instanceof PlatformUserNotFoundException)) throw error
      this.logger.error(`Aucun utilisateur avec l'email ${this.email}`)
      this.exitCode = 1
    }
  }
}
