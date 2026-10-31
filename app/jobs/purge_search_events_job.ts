import { inject } from '@adonisjs/core'
import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import SearchEventService from '#services/search_event_service'

/**
 * Pseudonymisation et purge planifiées du journal des recherches (#171, RGPD) :
 * cf. `SearchEventService#purge` et `start/scheduler.ts`.
 */
@inject()
export default class PurgeSearchEventsJob extends Job {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 3,
  }

  constructor(private events: SearchEventService) {
    super()
  }

  async execute() {
    const { pseudonymised, deleted } = await this.events.purge()
    if (pseudonymised > 0 || deleted > 0) {
      logger.info({ pseudonymised, deleted }, 'search events purged')
    }
  }

  async failed(error: Error) {
    logger.error({ err: error }, 'purge search events failed')
  }
}
