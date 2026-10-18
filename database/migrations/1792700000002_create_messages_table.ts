import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Messages d'un fil. Le suivi de lecture par participant n'est pas modélisé
 * ici : il se fera par une table dédiée quand l'UI en aura besoin, sans toucher
 * à cette table.
 */
export default class extends BaseSchema {
  protected tableName = 'messages'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('conversation_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('conversations')
        .onDelete('CASCADE')
      // Un auteur qui quitte la plateforme ne fait pas disparaître le fil.
      table
        .integer('author_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.text('body').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['conversation_id', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
