import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Fils de discussion acheteur ↔ fournisseur (#8). Pas de contrainte d'unicité
 * sur la paire d'organisations : une même paire peut échanger sur plusieurs
 * RFQ ou sujets. `rfq_id` est optionnel et délié si la RFQ disparaît.
 */
export default class extends BaseSchema {
  protected tableName = 'conversations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('buyer_organization_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      table
        .integer('supplier_organization_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      table
        .integer('rfq_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('rfqs')
        .onDelete('SET NULL')
      table.string('subject', 180).nullable()
      table
        .integer('created_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['buyer_organization_id'])
      table.index(['supplier_organization_id'])
      table.index(['rfq_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
