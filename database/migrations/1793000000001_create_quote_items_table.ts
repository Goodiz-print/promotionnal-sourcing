import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Lignes d'un devis (#5) : une ligne répond à un item de la demande.
 *
 * Pas de `variant_id` : la demande ne référence pas de variante, le devis non
 * plus — les options de personnalisation voyagent dans `customization_details`.
 * `total_price` est calculé côté serveur (`unit_price × quantity`).
 * `product_id` : `SET NULL`, supprimer un produit du catalogue ne doit pas
 * effacer un devis déjà remis.
 */
export default class extends BaseSchema {
  protected tableName = 'quote_items'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('quote_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('quotes')
        .onDelete('CASCADE')
      table
        .integer('rfq_item_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('rfq_items')
        .onDelete('CASCADE')
      table
        .integer('product_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('products')
        .onDelete('SET NULL')
      table.decimal('unit_price', 12, 4).notNullable()
      table.integer('quantity').unsigned().notNullable()
      table.decimal('total_price', 14, 2).notNullable()
      table.integer('lead_time_days').unsigned().notNullable()
      table.jsonb('customization_details').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['quote_id', 'rfq_item_id'])
      table.index(['rfq_item_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
