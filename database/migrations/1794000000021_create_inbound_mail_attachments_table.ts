import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Pièces jointes d'un mail entrant (#223), acceptées ou non. Le fichier d'une
 * pièce acceptée est porté par `storage_objects` ; la colonne figure dans
 * `STORAGE_REFERENCES` pour que son retrait libère l'objet.
 * `(inbound_mail_id, provider_attachment_id)` unique : un job rejoué ne
 * journalise ni ne stocke deux fois la même pièce.
 */
export default class extends BaseSchema {
  protected tableName = 'inbound_mail_attachments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('inbound_mail_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('inbound_mails')
        .onDelete('CASCADE')
      table.string('provider_attachment_id', 255).notNullable()
      table
        .integer('storage_object_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('storage_objects')
        .onDelete('SET NULL')
      table.string('filename', 255).notNullable()
      table.string('mime_type', 150).nullable()
      table.integer('size_bytes').unsigned().nullable()
      table.string('status', 20).notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['inbound_mail_id', 'provider_attachment_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
