import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Historique des décisions de modération (#54). Table en ajout seul : on ne
 * modifie jamais une décision, on en ajoute une nouvelle. Le statut courant
 * d'une cible est la dernière décision ; une cible sans décision est `pending`.
 *
 * Polymorphe (`target_type` / `target_id`) : pas de clé étrangère sur la cible,
 * donc une cible supprimée laisse son historique (utile pour l'audit).
 */
export default class extends BaseSchema {
  protected tableName = 'moderation_decisions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('target_type', 40).notNullable()
      table.integer('target_id').unsigned().notNullable()
      table.string('status', 20).notNullable()
      table.text('reason').nullable()
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

      table.index(['target_type', 'target_id', 'decided_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
