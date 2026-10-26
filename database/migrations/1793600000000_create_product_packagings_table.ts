import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Conditionnement / logistique produit (écart 3) : table **1:1** avec `products`
 * (garde `products` léger). Données rarement filtrées → colonnes simples, pas
 * d'EAV et **pas de facette Meilisearch**. `product_id` est **unique** (une ligne
 * par produit au plus) et casse en cascade avec le produit, comme les autres
 * tables filles.
 */
export default class extends BaseSchema {
  protected tableName = 'product_packagings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('product_id')
        .unsigned()
        .notNullable()
        .unique()
        .references('id')
        .inTable('products')
        .onDelete('CASCADE')
      // Type de conditionnement : champ libre (Polybag / Boîte cadeau / Étui /
      // Tube / Vrac / Blister…), pas un référentiel fermé.
      table.string('package_type').nullable()
      table.integer('unit_gross_weight_g').unsigned().nullable()
      table.integer('inner_carton_qty').unsigned().nullable()
      table.integer('outer_carton_qty').unsigned().nullable()
      table.integer('outer_carton_length_mm').unsigned().nullable()
      table.integer('outer_carton_width_mm').unsigned().nullable()
      table.integer('outer_carton_height_mm').unsigned().nullable()
      table.integer('outer_carton_gross_weight_g').unsigned().nullable()
      table.decimal('outer_carton_volume_m3', 12, 4).nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
