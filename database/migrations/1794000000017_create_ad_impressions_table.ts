import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Affichages d'un produit sponsorisé, agrégés par campagne, jour et
 * emplacement (un compteur incrémenté, pas une ligne par affichage).
 */
export default class extends BaseSchema {
  protected tableName = 'ad_impressions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('campaign_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('ad_campaigns')
        .onDelete('CASCADE')
      table.date('day').notNullable()
      table.string('placement', 20).notNullable()
      table.integer('count').unsigned().notNullable().defaultTo(0)

      table.unique(['campaign_id', 'day', 'placement'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
