import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import app from '@adonisjs/core/services/app'

/**
 * Purge planifiée des consultations (cf. `start/scheduler.ts`) : pseudonymise
 * puis supprime selon la rétention de `ActivityEventService#purge`.
 *
 * ⚠️ Exception à la règle « imports en haut du fichier » : le service importe un
 * **modèle Lucid**, évalué trop tôt si le job l'importait statiquement (la queue
 * charge les jobs au boot). Voir `PurgeExpiredInvitationsJob`.
 */
export default class PurgeActivityEventsJob extends Job {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 3,
  }

  async execute() {
    const { default: ActivityEventService } = await import('#services/activity_event_service')
    const service = await app.container.make(ActivityEventService)

    const { pseudonymized, deleted } = await service.purge()
    if (pseudonymized > 0 || deleted > 0) {
      logger.info({ pseudonymized, deleted }, 'activity events purged')
    }
  }

  async failed(error: Error) {
    logger.error({ err: error }, 'purge activity events failed')
  }
}
