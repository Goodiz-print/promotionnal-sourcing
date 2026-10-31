import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Consultations et funnel acheteur (#172) : vue produit, vue fournisseur, ajout
 * d'un produit à une demande de devis, envoi de la demande. La cible est
 * polymorphe (`target_type` / `target_id`) sans clé étrangère : l'historique
 * survit à la suppression de la cible. Même politique de rétention et de
 * pseudonymisation que `search_events`.
 */
export default class extends BaseSchema {
  protected tableName = 'activity_events'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('type', 30).notNullable()
      table.string('target_type', 20).notNullable()
      table.integer('target_id').unsigned().notNullable()
      table
        .integer('user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table
        .integer('organization_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('organizations')
        .onDelete('SET NULL')
      table.timestamp('created_at').notNullable().defaultTo(this.now())

      table.index(['created_at'])
      table.index(['type', 'created_at'])
      table.index(['target_type', 'target_id'])
      table.index(['user_id', 'type', 'target_type', 'target_id', 'created_at'])
      table.index(['organization_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
