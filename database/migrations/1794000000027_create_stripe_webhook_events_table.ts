import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Notifications Stripe d'abonnement déjà traitées (#215). `event_id` (unique)
 * rend le traitement idempotent : une notification rejouée par Stripe est
 * reconnue et ignorée.
 */
export default class extends BaseSchema {
  protected tableName = 'stripe_webhook_events'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').notNullable()
      table.string('event_id', 100).notNullable().unique()
      table.string('type', 100).notNullable()
      table.timestamp('created_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
