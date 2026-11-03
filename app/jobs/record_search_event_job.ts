import { inject } from '@adonisjs/core'
import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import SearchEventStore from '#services/search_event_store'
import type { SearchEventPayload } from '#shared/types/search_event'

/**
 * Enregistre une recherche dans le journal (#171), hors de la requête qui la
 * sert : aucun impact sur la latence de la recherche. Pas d'import de modèle
 * Lucid (les jobs sont chargés au boot) : le service passe par `db`.
 */
@inject()
export default class RecordSearchEventJob extends Job<SearchEventPayload> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 3,
  }

  constructor(private events: SearchEventStore) {
    super()
  }

  async execute() {
    await this.events.persist(this.payload)
  }

  async failed(error: Error) {
    logger.error({ err: error, source: this.payload.source }, 'record search event failed')
  }
}
