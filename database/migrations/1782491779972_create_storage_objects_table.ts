import { BaseSchema } from '@adonisjs/lucid/schema'
import { STORAGE_STATUSES } from '#shared/types/storage'

/**
 * Registre des objets du stockage Cellar : une ligne par objet stocké
 * (`ready`), plus les états transitoires qui garantissent l'absence
 * d'orphelins (`pending_upload` avant l'envoi, `pending_delete` après un
 * remplacement).
 *
 * `key` n'est unique que **hors** `pending_delete` (index partiel) : une pierre
 * tombale porte la clé d'un objet qui peut être, entre-temps, re-téléversé à
 * l'identique ; les deux lignes doivent pouvoir coexister, et le job de purge
 * arbitre au moment de supprimer.
 */
export default class extends BaseSchema {
  protected tableName = 'storage_objects'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('key', 512).notNullable()
      table.string('checksum', 64).notNullable()
      table.string('mime_type', 127).notNullable()
      table.integer('size').unsigned().notNullable()
      table.enu('status', [...STORAGE_STATUSES]).notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['status', 'created_at'])
      table.index('checksum')
    })
    this.schema.raw(
      `CREATE UNIQUE INDEX storage_objects_key_live_unique ON storage_objects (key) WHERE status <> 'pending_delete'`
    )
    this.schema.raw(`CREATE INDEX storage_objects_key_index ON storage_objects (key)`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
