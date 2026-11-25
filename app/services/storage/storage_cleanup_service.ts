import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import StorageObject from '#models/storage_object'
import StorageDriver from '#services/storage/storage_driver'
import { lockStorageKey } from '#services/storage/storage_lock'
import { STORAGE_RECOVERY_THRESHOLD_HOURS } from '#shared/types/storage'

/**
 * Travail de fond du stockage, appelé par les jobs `DeleteStorageObjectJob` et
 * `RecoverStorageUploadsJob` (qui le résolvent dans `execute()` : ce service
 * importe un modèle Lucid, cf. la règle DI de `CLAUDE.md`).
 */
@inject()
export default class StorageCleanupService {
  constructor(private driver: StorageDriver) {}

  /**
   * Traite une pierre tombale `pending_delete` : supprime l'objet **seulement**
   * si aucune ligne `ready` (ou `pending_upload`, envoi en cours) ne porte la
   * même clé, puis supprime la ligne. Supprimer un objet absent est un succès.
   * Retourne `true` si l'objet a été supprimé.
   */
  async purgeDeleted(tombstoneId: number): Promise<boolean> {
    const tombstone = await StorageObject.query()
      .where('id', tombstoneId)
      .where('status', 'pending_delete')
      .first()
    if (!tombstone) return false

    return db.transaction(async (trx) => {
      await lockStorageKey(trx, tombstone.key)

      const row = await StorageObject.query({ client: trx })
        .where('id', tombstone.id)
        .where('status', 'pending_delete')
        .first()
      if (!row) return false

      const inUse = await this.hasLiveRow(trx, row.key)
      if (!inUse) await this.driver.delete(row.key)

      await row.useTransaction(trx).delete()
      return !inUse
    })
  }

  /**
   * Reprise : nettoie les lignes `pending_upload` de plus de 24 h (objet
   * supprimé s'il existe, puis ligne) et rejoue les pierres tombales de même
   * âge dont le job de purge s'est perdu. Ne touche jamais une ligne `ready`.
   */
  async recoverStale(): Promise<{ uploads: number; deletions: number }> {
    const threshold = DateTime.now().minus({ hours: STORAGE_RECOVERY_THRESHOLD_HOURS })

    const staleUploads = await StorageObject.query()
      .where('status', 'pending_upload')
      .where('createdAt', '<', threshold.toSQL()!)
    const staleDeletions = await StorageObject.query()
      .where('status', 'pending_delete')
      .where('createdAt', '<', threshold.toSQL()!)

    let uploads = 0
    for (const stale of staleUploads) {
      try {
        const recovered = await this.recoverUpload(stale.id, threshold)
        if (recovered) uploads += 1
      } catch (error) {
        logger.error({ err: error, key: stale.key }, 'storage upload recovery failed')
      }
    }

    let deletions = 0
    for (const stale of staleDeletions) {
      try {
        await this.purgeDeleted(stale.id)
        deletions += 1
      } catch (error) {
        logger.error({ err: error, key: stale.key }, 'storage deletion recovery failed')
      }
    }

    return { uploads, deletions }
  }

  private async recoverUpload(id: number, threshold: DateTime): Promise<boolean> {
    const candidate = await StorageObject.find(id)
    if (!candidate) return false

    return db.transaction(async (trx) => {
      await lockStorageKey(trx, candidate.key)

      // Relue sous verrou : l'envoi a pu aboutir (ou être repris) entre-temps.
      const row = await StorageObject.query({ client: trx })
        .where('id', id)
        .where('status', 'pending_upload')
        .where('createdAt', '<', threshold.toSQL()!)
        .first()
      if (!row) return false

      const ready = await StorageObject.query({ client: trx })
        .where('key', row.key)
        .where('status', 'ready')
        .first()
      if (!ready && (await this.driver.exists(row.key))) await this.driver.delete(row.key)

      await row.useTransaction(trx).delete()
      return true
    })
  }

  private async hasLiveRow(trx: Parameters<typeof lockStorageKey>[0], key: string) {
    const live = await StorageObject.query({ client: trx })
      .where('key', key)
      .whereIn('status', ['ready', 'pending_upload'])
      .first()
    return live !== null
  }
}
