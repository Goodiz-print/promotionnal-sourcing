import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import storageConfig from '#config/storage'
import StorageObject from '#models/storage_object'
import StorageDriver from '#services/storage/storage_driver'
import { lockStorageKey } from '#services/storage/storage_lock'
import DeleteStorageObjectJob from '#jobs/delete_storage_object_job'
import {
  StorageSourceException,
  StorageUploadException,
  StorageUploadInProgressException,
} from '#exceptions/storage_errors'
import {
  STORAGE_PENDING_UPLOAD_TIMEOUT_MINUTES,
  STORAGE_REFERENCES,
  type PreparedUpload,
} from '#shared/types/storage'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * Stockage de fichiers **idempotent et sans orphelin**.
 *
 * Envoi (`store`) :
 *  1. une ligne `ready` existe pour cette clé → réutilisée, rien n'est envoyé ;
 *  2. sinon `pending_upload` posée (transaction courte), envoi, puis `ready` ;
 *  3. échec → ligne **et** objet supprimés (sauf s'ils servent une autre ligne).
 *
 * Remplacement / suppression d'une référence : `release` s'appelle **dans la
 * transaction** qui met la référence à jour et y écrit la ligne
 * `pending_delete` ; `dispatchDeletions` lance la purge après le commit.
 *
 * La clé dérive du contenu (`<préfixe>/<sha256>.<ext>`) : aucun nom aléatoire,
 * sinon un même fichier envoyé deux fois ne serait jamais dédoublonné.
 */
@inject()
export default class StorageService {
  constructor(private driver: StorageDriver) {}

  /**
   * Clé déterministe d'un contenu : `promotionnal-sourcing/<NODE_ENV>/<sha256>.<ext>`.
   */
  keyFor(checksum: string, extension: string): string {
    return `${storageConfig.keyPrefix}/${checksum}.${extension}`
  }

  /**
   * Sonde de santé (#179) : un `HEAD` sur une clé réservée prouve que Cellar répond
   * et que les identifiants sont valides, sans rien écrire. L'absence de l'objet
   * est normale ; seule une erreur (réseau, authentification) est propagée.
   */
  async ping(): Promise<void> {
    await this.driver.exists(`${storageConfig.keyPrefix}/healthcheck`)
  }

  /**
   * URL publique d'un objet stocké.
   */
  urlFor(object: StorageObject): string {
    return this.driver.url(object.key)
  }

  /**
   * Stocke un fichier (ou réutilise l'objet identique déjà stocké).
   */
  async store(file: MultipartFile): Promise<StorageObject> {
    return this.storeUpload(await this.prepare(file))
  }

  /**
   * Stocke un contenu produit par l'application (ex. variante d'image) — mêmes
   * garanties que `store` : clé déterministe, dédoublonnage, zéro orphelin.
   */
  storeContent(content: Buffer, extension: string, mimeType: string): Promise<StorageObject> {
    const checksum = createHash('sha256').update(content).digest('hex')
    return this.storeUpload({
      key: this.keyFor(checksum, extension),
      checksum,
      mimeType,
      size: content.length,
      content,
    })
  }

  private async storeUpload(upload: PreparedUpload): Promise<StorageObject> {
    const existing = await StorageObject.query()
      .where('key', upload.key)
      .where('status', 'ready')
      .first()
    if (existing) return existing

    const pending = await this.claim(upload)
    if (pending.status === 'ready') return pending

    try {
      await this.driver.put(upload.key, upload.content, upload.mimeType)
      await pending.merge({ status: 'ready' }).save()
      return pending
    } catch (error) {
      logger.error({ err: error, key: upload.key }, 'storage upload failed')
      await this.abandon(pending)
      throw new StorageUploadException(undefined, { cause: error })
    }
  }

  /**
   * Stocke plusieurs fichiers, **un par un** : deux fichiers identiques d'un
   * même lot s'enverraient sinon en concurrence. Si l'un échoue, ceux déjà
   * stockés sont libérés — aucun objet ne reste sans référence.
   */
  async storeMany(files: MultipartFile[]): Promise<StorageObject[]> {
    const stored: StorageObject[] = []
    try {
      for (const file of files) {
        stored.push(await this.store(file))
      }
    } catch (error) {
      await this.discard(stored.map((object) => object.id))
      throw error
    }
    return stored
  }

  /**
   * À appeler **dans la transaction** qui retire/remplace une référence vers
   * `objectId` (la référence doit déjà être mise à jour). Si plus rien ne
   * désigne l'objet, sa ligne `ready` est remplacée par une ligne
   * `pending_delete` pour la même clé. Retourne l'id de cette pierre tombale
   * (à passer à `dispatchDeletions` après le commit) ou `null`.
   */
  async release(trx: TransactionClientContract, objectId: number | null): Promise<number | null> {
    if (!objectId) return null

    const object = await StorageObject.query({ client: trx })
      .where('id', objectId)
      .where('status', 'ready')
      .first()
    if (!object) return null

    await lockStorageKey(trx, object.key)
    if ((await this.countReferences(trx, object.id)) > 0) return null

    await object.useTransaction(trx).delete()
    const tombstone = await StorageObject.create(
      {
        key: object.key,
        checksum: object.checksum,
        mimeType: object.mimeType,
        size: object.size,
        status: 'pending_delete',
      },
      { client: trx }
    )
    return tombstone.id
  }

  /**
   * Lance la purge des pierres tombales, **après** le commit. Un échec de mise
   * en queue n'est pas fatal : la ligne reste `pending_delete` et la reprise
   * planifiée la rejouera.
   */
  async dispatchDeletions(tombstoneIds: Array<number | null>): Promise<void> {
    for (const storageObjectId of tombstoneIds) {
      if (storageObjectId === null) continue
      try {
        await DeleteStorageObjectJob.dispatch({ storageObjectId })
      } catch (error) {
        logger.warn({ err: error, storageObjectId }, 'failed to queue storage object deletion')
      }
    }
  }

  /**
   * Libère des objets qui viennent d'être stockés mais dont la référence n'a
   * pas pu être écrite (échec de la transaction métier). Ne supprime que ce
   * qui n'est référencé par rien.
   */
  async discard(objectIds: number[]): Promise<void> {
    if (objectIds.length === 0) return
    try {
      const tombstones = await db.transaction(async (trx) => {
        const ids: Array<number | null> = []
        for (const id of objectIds) ids.push(await this.release(trx, id))
        return ids
      })
      await this.dispatchDeletions(tombstones)
    } catch (error) {
      logger.error({ err: error, objectIds }, 'failed to discard stored objects')
    }
  }

  /**
   * Nombre de références métier vers l'objet (cf. `STORAGE_REFERENCES`).
   */
  private async countReferences(client: TransactionClientContract, objectId: number) {
    let total = 0
    for (const { table, column } of STORAGE_REFERENCES) {
      const row = await client.from(table).where(column, objectId).count('* as total').first()
      total += Number(row?.total ?? 0)
    }
    return total
  }

  /**
   * Lit le fichier et en dérive tout ce qui le caractérise : checksum, taille,
   * extension, MIME et donc la clé.
   */
  private async prepare(file: MultipartFile): Promise<PreparedUpload> {
    if (!file.tmpPath) throw new StorageSourceException()

    let content: Buffer
    try {
      content = await readFile(file.tmpPath)
    } catch (error) {
      throw new StorageSourceException(undefined, { cause: error })
    }

    const checksum = createHash('sha256').update(content).digest('hex')
    const extension = (file.extname ?? '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
    const mimeType =
      file.type && file.subtype ? `${file.type}/${file.subtype}` : 'application/octet-stream'

    return {
      key: this.keyFor(checksum, extension),
      checksum,
      mimeType,
      size: content.length,
      content,
    }
  }

  /**
   * Pose la ligne `pending_upload` (ou renvoie la ligne `ready` apparue entre-
   * temps), sous verrou de clé. Une ligne `pending_upload` récente signale un
   * envoi concurrent ; une ancienne (appel interrompu) est reprise.
   */
  private claim(upload: PreparedUpload): Promise<StorageObject> {
    return db.transaction(async (trx) => {
      await lockStorageKey(trx, upload.key)

      const live = await StorageObject.query({ client: trx })
        .where('key', upload.key)
        .whereIn('status', ['ready', 'pending_upload'])
        .first()

      if (live?.status === 'ready') return live

      if (live) {
        const ageMinutes = DateTime.now().diff(live.createdAt, 'minutes').minutes
        if (ageMinutes < STORAGE_PENDING_UPLOAD_TIMEOUT_MINUTES) {
          throw new StorageUploadInProgressException()
        }
        await live.useTransaction(trx).merge({ createdAt: DateTime.now() }).save()
        return live
      }

      return StorageObject.create(
        {
          key: upload.key,
          checksum: upload.checksum,
          mimeType: upload.mimeType,
          size: upload.size,
          status: 'pending_upload',
        },
        { client: trx }
      )
    })
  }

  /**
   * Échec d'envoi : supprime la ligne `pending_upload` et l'objet s'il existe,
   * sauf si une autre ligne vivante porte la même clé. Si ce nettoyage échoue
   * à son tour, la ligne reste `pending_upload` et la reprise s'en charge.
   */
  private async abandon(pending: StorageObject): Promise<void> {
    try {
      await db.transaction(async (trx) => {
        await lockStorageKey(trx, pending.key)

        const row = await StorageObject.query({ client: trx })
          .where('id', pending.id)
          .where('status', 'pending_upload')
          .first()
        if (!row) return

        const other = await StorageObject.query({ client: trx })
          .where('key', row.key)
          .whereNot('id', row.id)
          .whereIn('status', ['ready', 'pending_upload'])
          .first()
        if (!other) await this.driver.delete(row.key)

        await row.useTransaction(trx).delete()
      })
    } catch (error) {
      logger.error({ err: error, key: pending.key }, 'storage upload cleanup failed')
    }
  }
}
