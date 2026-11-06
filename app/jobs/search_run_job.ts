import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import app from '@adonisjs/core/services/app'

interface SearchRunPayload {
  /** Identifiant de la ligne `search_runs` à exécuter. */
  runId: number
}

/**
 * Réindexation ou évaluation de la recherche demandée depuis le back-office
 * (#176). L'avancement et le résultat sont écrits sur la ligne `search_runs` ;
 * pas de nouvel essai automatique (l'admin relance depuis l'écran) et un rejeu
 * du job est sans effet une fois l'opération prise en charge.
 *
 * `AdminSearchService` importe le modèle `Product` : un job est chargé au boot de
 * la queue, avant le service `hash` (voir la règle DI de `CLAUDE.md`). Le service
 * est donc importé et résolu dans `execute()` uniquement.
 */
export default class SearchRunJob extends Job<SearchRunPayload> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 0,
  }

  async execute() {
    const { default: AdminSearchService } = await import('#services/admin_search_service')
    const service = await app.container.make(AdminSearchService)
    await service.execute(this.payload.runId)
  }

  async failed(error: Error) {
    logger.error({ err: error, runId: this.payload.runId }, 'search run job failed')
  }
}
