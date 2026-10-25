import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Lignes d'une commande (#6), copiées des lignes du devis accepté.
 *
 * Pas de `variant_id` (le catalogue n'a pas de variantes côté devis, voir
 * `quote_items`). `name` fige le libellé de l'item de la demande : la commande
 * reste lisible même si la demande ou le produit changent ensuite. `product_id` :
 * `SET NULL`, retirer un produit du catalogue ne doit pas effacer une commande.
 */
export default class extends BaseSchema {
  protected tableName = 'order_items'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('order_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('orders')
        .onDelete('CASCADE')
      table
        .integer('quote_item_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('quote_items')
        .onDelete('RESTRICT')
      table
        .integer('product_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('products')
        .onDelete('SET NULL')
      table.string('name', 255).notNullable()
      table.integer('quantity').unsigned().notNullable()
      table.decimal('unit_price', 12, 4).notNullable()
      table.decimal('total_price', 14, 2).notNullable()
      table.jsonb('customization_details').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['order_id', 'quote_item_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
