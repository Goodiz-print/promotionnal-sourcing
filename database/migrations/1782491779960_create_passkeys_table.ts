import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'passkeys'

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
      // Identifiant WebAuthn (base64url) : unique pour toute la plateforme, il sert
      // à retrouver le compte lors d'une connexion sans saisie d'email.
      table.string('credential_id', 512).notNullable().unique()
      table.text('public_key').notNullable()
      table.bigInteger('counter').notNullable().defaultTo(0)
      table.specificType('transports', 'text[]').nullable()
      table.string('device_type', 32).notNullable()
      table.boolean('backed_up').notNullable().defaultTo(false)
      table.string('name', 100).notNullable()
      table.timestamp('last_used_at').nullable()
      table.timestamp('created_at').notNullable().defaultTo(this.now())
      table.timestamp('updated_at').nullable()
      table.index(['user_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
