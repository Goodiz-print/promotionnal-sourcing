import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Notifications in-app (#57). Le `type` est une chaîne validée côté code
 * (`NOTIFICATION_TYPES`), pas un enum SQL : un nouveau type ne demande pas de
 * migration. `data` porte le contexte nécessaire à l'affichage.
 */
export default class extends BaseSchema {
  protected tableName = 'notifications'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('type', 80).notNullable()
      table.jsonb('data').notNullable().defaultTo('{}')
      table.timestamp('read_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Cloche de notifications : « non lues de cet utilisateur », récentes d'abord.
      table.index(['user_id', 'read_at', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
