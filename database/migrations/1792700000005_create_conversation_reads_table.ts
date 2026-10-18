import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Suivi de lecture d'un fil, par participant. Une ligne par (fil, utilisateur) :
 * `last_read_message_id` est le dernier message vu. Les messages postérieurs
 * d'un autre auteur sont « non lus ». Supprimer le message de référence ne fait
 * pas perdre la lecture (la référence passe à NULL, la date reste).
 */
export default class extends BaseSchema {
  protected tableName = 'conversation_reads'

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
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .integer('last_read_message_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('messages')
        .onDelete('SET NULL')
      table.timestamp('read_at').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['conversation_id', 'user_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
