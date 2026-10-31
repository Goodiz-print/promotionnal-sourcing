import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import app from '@adonisjs/core/services/app'

/**
 * Purge planifiée des données de demande client (cf. `start/scheduler.ts`) :
 * recherches (#171) et consultations (#172), pseudonymisées puis supprimées selon
 * la rétention de `SearchEventService#purge` et `ActivityEventService#purge`.
 *
 * ⚠️ Exception à la règle « imports en haut du fichier » : le service importe un
 * **modèle Lucid**, évalué trop tôt si le job l'importait statiquement (la queue
 * charge les jobs au boot). Voir `PurgeExpiredInvitationsJob`.
 */
export default class PurgeDemandEventsJob extends Job {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 3,
  }

  async execute() {
    const { default: SearchEventService } = await import('#services/search_event_service')
    const { default: ActivityEventService } = await import('#services/activity_event_service')
    const searches = await app.container.make(SearchEventService)
    const activities = await app.container.make(ActivityEventService)

    const search = await searches.purge()
    const activity = await activities.purge()
    logger.info({ search, activity }, 'demand events purged')
  }

  async failed(error: Error) {
    logger.error({ err: error }, 'purge demand events failed')
  }
}
