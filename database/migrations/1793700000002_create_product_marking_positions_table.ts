import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Zones de marquage d'un produit (écart 2), 1..N par produit. Chaque position
 * porte des dimensions max imprimables et peut pointer un gabarit — un document
 * du produit de type `marking_template` (`product_documents.type`). Le nombre de
 * positions est dérivé du `count`, pas stocké.
 */
export default class extends BaseSchema {
  protected tableName = 'product_marking_positions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('product_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('products')
        .onDelete('CASCADE')
      table.string('name', 255).notNullable()
      table.integer('max_width_mm').unsigned().nullable()
      table.integer('max_height_mm').unsigned().nullable()
      // Gabarit de marquage : document du produit de type `marking_template`.
      // `SET NULL` : supprimer le document ne supprime pas la position.
      table
        .integer('template_document_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('product_documents')
        .onDelete('SET NULL')
      table.integer('position').notNullable().defaultTo(0)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index('product_id')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
