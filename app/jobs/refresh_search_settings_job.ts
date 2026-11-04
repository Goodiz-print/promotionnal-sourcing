import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import app from '@adonisjs/core/services/app'
import SearchEngine from '#services/search/search_engine'

/**
 * Rafraichit les reglages de l'index de recherche (#165) : reapplique les
 * attributs filtrables (`attributes.<slug>`) derives de `category_attributes.is_filter`.
 *
 * Dispatche par `SearchSyncService.queueSettings()` quand `is_filter` d'un
 * pivot categorie-attribut change (ajout/retrait/modification).
 *
 * **Idempotent** : les reglages sont recalcules depuis PostgreSQL a chaque
 * execution. No-op si l'index n'existe pas encore.
 *
 * NB : pas d'import statique de modele Lucid (regle CLAUDE.md) — le moteur
 * est resolu par DI et n'importe pas de modele directement.
 */
export default class RefreshSearchSettingsJob extends Job<{}> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 3,
  }

  async execute() {
    const engine = await app.container.make(SearchEngine)
    if (!engine.enabled) return

    await engine.refreshSettings()
    logger.info('search settings refreshed')
  }

  async failed(error: Error) {
    logger.error({ err: error }, 'search settings refresh failed')
  }
}
