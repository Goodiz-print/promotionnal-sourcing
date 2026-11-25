import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Clics sur un produit sponsorisé, facturés ou non (`billed`, `unbilled_reason`).
 * Sert le dédoublonnage par visiteur, le budget quotidien et les statistiques.
 * `visitor_hash` est une empreinte (HMAC de l'IP et du navigateur) : aucune
 * adresse IP n'est conservée.
 */
export default class extends BaseSchema {
  protected tableName = 'ad_clicks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').notNullable()
      table
        .integer('campaign_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('ad_campaigns')
        .onDelete('CASCADE')
      table.string('placement', 20).notNullable()
      table.string('visitor_hash', 64).notNullable()
      table
        .integer('user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.integer('cost_cents').unsigned().notNullable().defaultTo(0)
      table.boolean('billed').notNullable().defaultTo(false)
      table.string('unbilled_reason', 30).nullable()
      table.timestamp('created_at').notNullable()

      table.index(['campaign_id', 'created_at'])
      table.index(['campaign_id', 'visitor_hash', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
