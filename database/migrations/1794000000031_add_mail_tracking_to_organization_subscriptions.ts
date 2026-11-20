import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Mails d'abonnement (#237) : trace des envois, pour qu'un mail ne parte
 * qu'une fois même si le job planifié repasse.
 *
 * - `activation_notified_at` : mail d'activation envoyé.
 * - `reminded_ends_at` + `reminded_days` : dernier rappel d'échéance envoyé (30
 *   ou 7 jours avant) **pour cette date de fin**. Une prolongation change
 *   `ends_at` : les rappels repartent pour la nouvelle date, jamais pour l'ancienne.
 */
export default class extends BaseSchema {
  protected tableName = 'organization_subscriptions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('activation_notified_at').nullable()
      table.timestamp('reminded_ends_at').nullable()
      table.smallint('reminded_days').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('activation_notified_at')
      table.dropColumn('reminded_ends_at')
      table.dropColumn('reminded_days')
    })
  }
}
