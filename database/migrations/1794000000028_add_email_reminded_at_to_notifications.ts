import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Rappel par mail des notifications importantes non lues (#243).
 * `email_reminded_at` : date d'envoi du rappel (null tant qu'aucun n'est parti).
 * L'index partiel sert la sélection du job planifié : seules les notifications
 * non lues et sans rappel y figurent, il reste donc petit.
 */
export default class extends BaseSchema {
  protected tableName = 'notifications'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('email_reminded_at').nullable()
    })
    this.schema.raw(
      `CREATE INDEX notifications_pending_email_reminder_index
         ON notifications (type, created_at)
         WHERE read_at IS NULL AND email_reminded_at IS NULL`
    )
  }

  async down() {
    this.schema.raw('DROP INDEX IF EXISTS notifications_pending_email_reminder_index')
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('email_reminded_at')
    })
  }
}
