import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Journal d'audit des actions d'écriture du back-office (#159). Table en ajout
 * seul : on n'expose ni mise à jour ni suppression. `actor_email` est un
 * instantané : il survit à la suppression du compte (clé étrangère
 * `SET NULL`). La cible est polymorphe (`target_type` / `target_id`), sans clé
 * étrangère, pour que l'historique survive à la suppression de la cible.
 */
export default class extends BaseSchema {
  protected tableName = 'admin_audit_logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('actor_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.string('actor_email', 254).nullable()
      table.string('action', 64).notNullable()
      table.string('target_type', 40).nullable()
      table.integer('target_id').unsigned().nullable()
      table.jsonb('changes').nullable()
      table.string('ip_address', 45).nullable()
      table.timestamp('created_at').notNullable().defaultTo(this.now())

      table.index(['created_at'])
      table.index(['action', 'created_at'])
      table.index(['target_type', 'target_id'])
      table.index(['actor_user_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
