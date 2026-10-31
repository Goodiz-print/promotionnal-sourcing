import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import app from '@adonisjs/core/services/app'
import type { SearchEventPayload } from '#shared/types/search_event'

/**
 * Écrit un événement de recherche (#171) hors de la requête HTTP : la recherche
 * du client n'attend jamais l'écriture du journal.
 *
 * ⚠️ Exception à la règle « imports en haut du fichier » : `SearchEventService`
 * importe le **modèle** `SearchEvent`, et la queue charge les modules de job
 * **au boot** (`loadJobs`) — évaluer un modèle Lucid à ce stade casse le service
 * `hash`. Le service est donc importé et résolu dans `execute()`, comme
 * `IndexProductJob`. Voir la règle DI de `CLAUDE.md`.
 */
export default class RecordSearchEventJob extends Job<SearchEventPayload> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 2,
  }

  async execute() {
    const { default: SearchEventService } = await import('#services/search_event_service')
    const service = await app.container.make(SearchEventService)
    await service.store(this.payload)
  }

  async failed(error: Error) {
    logger.warn({ err: error }, 'search event not recorded')
  }
}
