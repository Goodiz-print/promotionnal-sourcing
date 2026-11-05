import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Annonces plateforme (#169). `translations` porte le contenu par langue
 * (`{ fr: { title, body }, en: … }`) ; `notifications.announcement_id` relie
 * chaque notification in-app à son annonce, ce qui donne le taux de lecture et
 * rend la distribution idempotente (une notification par annonce et utilisateur).
 */
export default class extends BaseSchema {
  protected tableName = 'announcements'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('created_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.string('audience', 20).notNullable()
      table
        .integer('organization_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('organizations')
        .onDelete('SET NULL')
      table.boolean('send_in_app').notNullable().defaultTo(true)
      table.boolean('send_email').notNullable().defaultTo(false)
      table.jsonb('translations').notNullable()
      table.string('status', 20).notNullable().defaultTo('queued')
      table.integer('recipients_count').notNullable().defaultTo(0)
      table.text('error').nullable()
      table.timestamp('sent_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['created_at'])
    })

    this.schema.alterTable('notifications', (table) => {
      table
        .integer('announcement_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable(this.tableName)
        .onDelete('SET NULL')
      // Les NULL sont distincts en PostgreSQL : les notifications hors annonce ne sont pas concernées.
      table.unique(['announcement_id', 'user_id'])
    })
  }

  async down() {
    this.schema.alterTable('notifications', (table) => {
      table.dropUnique(['announcement_id', 'user_id'])
      table.dropColumn('announcement_id')
    })
    this.schema.dropTable(this.tableName)
  }
}
