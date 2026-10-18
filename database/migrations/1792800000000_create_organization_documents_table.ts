import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Documents PDF d'une organisation fournisseur (catalogue, certificat…) (#60).
 * Le fichier est porté par `storage_objects` ; la colonne doit figurer dans
 * `STORAGE_REFERENCES` pour que son retrait libère l'objet.
 */
export default class extends BaseSchema {
  protected tableName = 'organization_documents'

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
      table.string('kind', 20).notNullable()
      table
        .integer('storage_object_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('storage_objects')
        .onDelete('SET NULL')
      table.string('original_name', 255).notNullable()
      table.integer('size_bytes').unsigned().notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['organization_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
