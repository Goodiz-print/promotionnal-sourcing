import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import app from '@adonisjs/core/services/app'

interface DeleteStorageObjectPayload {
  storageObjectId: number
}

/**
 * Purge d'une ligne `pending_delete` (posée à un remplacement / une
 * suppression de fichier) : supprime l'objet **seulement** s'il n'est plus
 * porté par une ligne `ready`, puis supprime la ligne. Un objet déjà absent
 * est un succès.
 *
 * ⚠️ Exception à la règle « imports en haut du fichier » : la queue charge les
 * modules de job **au boot** (`loadJobs`), or `StorageCleanupService` importe
 * un **modèle Lucid** — l'évaluer à ce stade casse la résolution du service
 * `hash` (`@adonisjs/auth`). Le service est donc importé et résolu dans
 * `execute()`, à l'image de `PurgeExpiredInvitationsJob`. Voir la règle DI de
 * `CLAUDE.md`.
 */
export default class DeleteStorageObjectJob extends Job<DeleteStorageObjectPayload> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 5,
  }

  async execute() {
    const { default: StorageCleanupService } =
      await import('#services/storage/storage_cleanup_service')
    const cleanup = await app.container.make(StorageCleanupService)

    await cleanup.purgeDeleted(this.payload.storageObjectId)
  }

  async failed(error: Error) {
    logger.error(
      { err: error, storageObjectId: this.payload.storageObjectId },
      'storage object deletion failed'
    )
  }
}
