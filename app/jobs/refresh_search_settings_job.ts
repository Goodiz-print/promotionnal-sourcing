import { inject } from '@adonisjs/core'
import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
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
 * est injecte par le constructeur et n'importe pas de modele directement.
 */
@inject()
export default class RefreshSearchSettingsJob extends Job<{}> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 3,
  }

  constructor(private engine: SearchEngine) {
    super()
  }

  async execute() {
    if (!this.engine.enabled) return

    await this.engine.refreshSettings()
    logger.info('search settings refreshed')
  }

  async failed(error: Error) {
    logger.error({ err: error }, 'search settings refresh failed')
  }
}
