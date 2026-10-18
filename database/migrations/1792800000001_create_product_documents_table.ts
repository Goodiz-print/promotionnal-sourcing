import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Fiches techniques PDF rattachées à un produit (#60). Même principe que
 * `organization_documents` : le fichier vit dans `storage_objects`.
 */
export default class extends BaseSchema {
  protected tableName = 'product_documents'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('product_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('products')
        .onDelete('CASCADE')
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

      table.index(['product_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
