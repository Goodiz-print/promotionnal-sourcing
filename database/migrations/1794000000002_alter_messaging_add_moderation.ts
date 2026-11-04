import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Modération de la messagerie (#167) : un message peut être masqué (le corps
 * reste en base, mais n'est plus montré aux participants) et un fil peut être
 * bloqué (plus aucun message ne peut y être posté).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('messages', (table) => {
      table.timestamp('hidden_at').nullable()
      table
        .integer('hidden_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
    })

    this.schema.alterTable('conversations', (table) => {
      table.timestamp('blocked_at').nullable()
      table.text('blocked_reason').nullable()
      table
        .integer('blocked_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable('conversations', (table) => {
      table.dropColumn('blocked_by_user_id')
      table.dropColumn('blocked_reason')
      table.dropColumn('blocked_at')
    })
    this.schema.alterTable('messages', (table) => {
      table.dropColumn('hidden_by_user_id')
      table.dropColumn('hidden_at')
    })
  }
}
