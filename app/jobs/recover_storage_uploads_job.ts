import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import app from '@adonisjs/core/services/app'

/**
 * Reprise planifiée (cf. `start/scheduler.ts`) : traite les lignes
 * `pending_upload` de plus de 24 h — envoi interrompu par un crash — en
 * supprimant l'objet s'il existe puis la ligne. Rejoue aussi les pierres
 * tombales `pending_delete` de même âge (job de purge perdu). Ne touche jamais
 * une ligne `ready`.
 *
 * ⚠️ Exception à la règle « imports en haut du fichier » : même raison que
 * `DeleteStorageObjectJob` — le service importe un modèle Lucid, il est donc
 * importé et résolu dans `execute()`.
 */
export default class RecoverStorageUploadsJob extends Job {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 3,
  }

  async execute() {
    const { default: StorageCleanupService } =
      await import('#services/storage/storage_cleanup_service')
    const cleanup = await app.container.make(StorageCleanupService)

    const { uploads, deletions } = await cleanup.recoverStale()
    if (uploads > 0 || deletions > 0) {
      logger.info({ uploads, deletions }, 'stale storage objects recovered')
    }
  }

  async failed(error: Error) {
    logger.error({ err: error }, 'storage recovery failed')
  }
}
