import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { inject } from '@adonisjs/core'
import HealthService from '#services/health_service'

/**
 * Supervision du worker (#61) : sortie 1 si des jobs sont en retard ou bloqués.
 * Destiné au healthcheck du conteneur worker et aux alertes cron.
 */
export default class QueueHealth extends BaseCommand {
  static commandName = 'queue:health'
  static description = 'Vérifie le backlog et les jobs bloqués de la queue (sortie 1 si dégradé)'

  static options: CommandOptions = {
    startApp: true,
  }

  @inject()
  async run(health: HealthService) {
    try {
      const report = await health.queueReport()
      this.logger.log(JSON.stringify(report))
      if (!report.ok) this.exitCode = 1
    } catch (error) {
      this.logger.error(`queue health check failed: ${(error as Error).message}`)
      this.exitCode = 1
    }
  }
}
