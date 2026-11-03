import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Historique des décisions de revue des inscriptions agence (#162). Table en
 * ajout seul : le statut courant d'une agence est sa dernière décision.
 * `review_reasons` garde les motifs de revue au moment de la décision (l'approbation
 * vide ensuite `organizations.review_reasons`).
 */
export default class extends BaseSchema {
  protected tableName = 'agency_review_decisions'

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
      table.string('decision', 20).notNullable()
      table.text('reason').nullable()
      table.specificType('review_reasons', 'text[]').notNullable().defaultTo('{}')
      table
        .integer('decided_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('decided_at').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['organization_id', 'decided_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
