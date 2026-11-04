import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Signalements de messages par les participants d'un fil (#167). Un
 * utilisateur ne signale un message qu'une fois (unicité message + signalant) ;
 * le signalement survit au départ du signalant (`SET NULL`) mais disparaît avec
 * son message.
 */
export default class extends BaseSchema {
  protected tableName = 'message_reports'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('message_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('messages')
        .onDelete('CASCADE')
      table
        .integer('reporter_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.string('reason', 30).notNullable()
      table.text('details').nullable()
      table.string('status', 20).notNullable().defaultTo('open')
      table.string('resolution', 20).nullable()
      table.text('resolution_note').nullable()
      table
        .integer('handled_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('handled_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['message_id', 'reporter_user_id'])
      table.index(['status', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
