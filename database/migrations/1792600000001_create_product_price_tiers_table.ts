import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Paliers de prix dégressifs : à partir de `min_quantity` pièces, le prix
 * unitaire est `unit_price`. `variant_id` NULL = palier du produit (toutes
 * variantes) ; renseigné = palier propre à la variante.
 */
export default class extends BaseSchema {
  protected tableName = 'product_price_tiers'

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
        .integer('variant_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('product_variants')
        .onDelete('CASCADE')
      table.integer('min_quantity').unsigned().notNullable()
      table.decimal('unit_price', 12, 4).notNullable()
      table.string('currency', 3).notNullable().defaultTo('EUR')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['product_id', 'min_quantity'])
      table.index('variant_id')
    })

    // `NULLS NOT DISTINCT` (PG ≥ 15) : deux paliers produit (variant_id NULL)
    // de même quantité sont aussi rejetés.
    this.schema.raw(
      `CREATE UNIQUE INDEX product_price_tiers_unique_idx
         ON ${this.tableName} (product_id, variant_id, min_quantity) NULLS NOT DISTINCT`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
