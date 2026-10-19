import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { ImportJobSchema } from '#database/schema'
import Organization from '#models/organization'
import StorageObject from '#models/storage_object'
import User from '#models/user'
import type { ImportKind, ImportRowError, ImportStatus } from '#shared/types/import_job'

/**
 * Import en masse suivi : statut, progression et erreurs ligne par ligne.
 * Les transitions passent par `ImportJobService`, jamais par une écriture directe.
 */
export default class ImportJob extends ImportJobSchema {
  static table = 'import_jobs'

  declare kind: ImportKind
  declare status: ImportStatus
  /**
   * `pg` envoie un tableau JS comme un tableau SQL, pas comme du JSON : on
   * sérialise explicitement pour que la colonne `jsonb` reçoive un document.
   */
  @column({ prepare: (value: ImportRowError[]) => JSON.stringify(value) })
  declare errors: ImportRowError[]

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>

  @belongsTo(() => User, { foreignKey: 'createdByUserId' })
  declare createdBy: BelongsTo<typeof User>

  @belongsTo(() => StorageObject, { foreignKey: 'sourceStorageObjectId' })
  declare source: BelongsTo<typeof StorageObject>
}
