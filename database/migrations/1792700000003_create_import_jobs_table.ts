import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Suivi des imports en masse (#49, #77). Les erreurs ligne par ligne sont
 * stockées en JSON, bornées côté service (`IMPORT_MAX_STORED_ERRORS`) ; le
 * compteur `error_count` reste exact au-delà de la borne.
 */
export default class extends BaseSchema {
  protected tableName = 'import_jobs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('organization_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      table
        .integer('created_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.string('kind', 60).notNullable()
      table.string('status', 20).notNullable().defaultTo('pending')
      // Fichier source, déjà stocké via StorageService (cf. docs/storage.md).
      table
        .integer('source_storage_object_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('storage_objects')
        .onDelete('SET NULL')
      table.integer('total_rows').unsigned().notNullable().defaultTo(0)
      table.integer('processed_rows').unsigned().notNullable().defaultTo(0)
      table.integer('error_count').unsigned().notNullable().defaultTo(0)
      table.jsonb('errors').notNullable().defaultTo('[]')
      table.timestamp('started_at').nullable()
      table.timestamp('finished_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['organization_id', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
