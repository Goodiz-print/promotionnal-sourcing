import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'rfq_items'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('rfq_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('rfqs')
        .onDelete('CASCADE')
      // Catégorie et produit sont facultatifs et indépendants : besoin libre,
      // besoin cadré par une catégorie, ou référence à un produit du catalogue.
      // `SET NULL` — supprimer un produit du catalogue ne doit pas effacer la
      // ligne d'une demande déjà envoyée (`name` reste porté par l'item).
      table
        .integer('category_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('categories')
        .onDelete('SET NULL')
      table
        .integer('product_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('products')
        .onDelete('SET NULL')
      table.string('name', 180).notNullable()
      table.text('description').nullable()
      table.integer('quantity').unsigned().notNullable()
      table.string('unit', 32).nullable()
      table.jsonb('specs').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['rfq_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
