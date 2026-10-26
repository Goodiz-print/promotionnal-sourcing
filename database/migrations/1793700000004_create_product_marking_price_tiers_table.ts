import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Grille de prix de marquage (écart 2) : à partir de `min_quantity` pièces, le
 * marquage dans cette technique coûte `unit_price` par pièce. Patron identique à
 * `product_price_tiers`, indexé par technique (pas par variante).
 */
export default class extends BaseSchema {
  protected tableName = 'product_marking_price_tiers'

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
      table
        .integer('marking_technique_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('marking_techniques')
      table.integer('min_quantity').unsigned().notNullable()
      table.decimal('unit_price', 12, 4).notNullable()
      table.string('currency', 3).notNullable().defaultTo('EUR')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['product_id', 'min_quantity'])
      table.unique(['product_id', 'marking_technique_id', 'min_quantity'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
