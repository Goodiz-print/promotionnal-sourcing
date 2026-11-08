import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import app from '@adonisjs/core/services/app'

/**
 * Surveillance planifiée de la plateforme (#179) : cf. `HealthMonitorService#check`
 * et `start/scheduler.ts`. Aucune reprise : la passe suivante recalcule tout.
 *
 * ⚠️ Exception à la règle « imports en haut du fichier » : le service dépend de
 * `StorageService`, donc d'un modèle Lucid ; il est importé et résolu dans
 * `execute()` (la queue charge les jobs au boot, avant que les modèles soient sûrs).
 */
export default class CheckPlatformHealthJob extends Job {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 0,
  }

  async execute() {
    const { default: HealthMonitorService } = await import('#services/health_monitor_service')
    const monitor = await app.container.make(HealthMonitorService)
    const report = await monitor.check()
    if (report && report.status !== 'ok')
      logger.warn({ status: report.status }, 'platform health degraded')
  }

  async failed(error: Error) {
    logger.error({ err: error }, 'platform health check failed')
  }
}
