import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Campagne de sponsorisation : un produit, une enchère maximale par clic, un
 * budget quotidien, une période. Au plus une campagne par produit (on la met en
 * pause ou on la modifie plutôt que d'en empiler).
 */
export default class extends BaseSchema {
  protected tableName = 'ad_campaigns'

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
      table
        .integer('product_id')
        .unsigned()
        .notNullable()
        .unique()
        .references('id')
        .inTable('products')
        .onDelete('CASCADE')
      table.string('status', 20).notNullable().defaultTo('active')
      table.integer('max_cpc_cents').unsigned().notNullable()
      table.integer('daily_budget_cents').unsigned().notNullable()
      table.date('starts_on').notNullable()
      table.date('ends_on').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Sélection des campagnes éligibles à chaque affichage.
      table.index(['status', 'starts_on'])
      table.index(['organization_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
