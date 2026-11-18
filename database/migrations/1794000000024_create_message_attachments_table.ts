import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Pièces jointes d'un message (#224). Le fichier est porté par
 * `storage_objects` ; la colonne figure dans `STORAGE_REFERENCES` pour que son
 * retrait libère l'objet.
 */
export default class extends BaseSchema {
  protected tableName = 'message_attachments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('message_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('messages')
        .onDelete('CASCADE')
      table
        .integer('storage_object_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('storage_objects')
        .onDelete('SET NULL')
      table.string('filename', 255).notNullable()
      table.string('mime_type', 150).notNullable()
      table.integer('size_bytes').unsigned().notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['message_id'])
      table.index(['storage_object_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
