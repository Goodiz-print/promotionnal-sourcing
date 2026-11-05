import { inject } from '@adonisjs/core'
import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import ImportRunner from '#services/import_runner'
import type { RunImportPayload } from '#shared/types/admin_import'

/**
 * Traite un import en masse (#170). Pas de nouvel essai automatique : un import
 * qui échoue est relancé à la main depuis le back-office, avec son historique.
 * Pas d'import de modèle Lucid : les jobs sont chargés au boot de la queue.
 */
@inject()
export default class RunImportJob extends Job<RunImportPayload> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 0,
    removeOnFail: { age: '30d' },
  }

  constructor(private runner: ImportRunner) {
    super()
  }

  async execute() {
    await this.runner.run(this.payload.importJobId)
  }

  async failed(error: Error) {
    logger.error({ err: error, importJobId: this.payload.importJobId }, 'import failed')
    await this.runner.fail(this.payload.importJobId, error.message)
  }
}
