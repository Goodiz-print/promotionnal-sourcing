import { BaseSchema } from '@adonisjs/lucid/schema'
import { INBOUND_MAIL_STATUSES } from '#shared/types/inbound_mail'

/**
 * Journal des mails entrants (#223) : une ligne par mail annoncé par le
 * prestataire de réception, y compris ceux qui sont écartés (adresse inconnue,
 * réponse automatique…). `(provider, provider_message_id)` unique rend la
 * réception idempotente : un webhook rejoué ne crée pas de seconde ligne.
 */
export default class extends BaseSchema {
  protected tableName = 'inbound_mails'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('provider', 20).notNullable()
      table.string('provider_message_id', 255).notNullable()
      table.text('message_id').nullable()
      // Couple demande / fournisseur visé ; `null` tant que l'adresse n'est pas
      // résolue, ou si elle est inconnue.
      table
        .integer('rfq_supplier_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('rfq_suppliers')
        .onDelete('SET NULL')
      table.string('recipient', 320).nullable()
      table.string('sender_address', 320).notNullable()
      table.string('sender_name', 255).nullable()
      // L'expéditeur est-il une adresse connue du fournisseur ? Indicatif : le
      // jeton de l'adresse relais fait foi, pas l'expéditeur.
      table.boolean('sender_known').nullable()
      table.text('subject').nullable()
      table.text('text_body').nullable()
      table.text('html_body').nullable()
      table.jsonb('headers').nullable()
      table.integer('size_bytes').unsigned().nullable()
      table.string('status', 20).notNullable().defaultTo(INBOUND_MAIL_STATUSES.received)
      table.string('rejection_reason', 30).nullable()
      table.text('error').nullable()
      table.timestamp('received_at').notNullable()
      table.timestamp('processed_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['provider', 'provider_message_id'])
      // Supervision (#227) : mails par état, les plus récents d'abord.
      table.index(['status', 'received_at'])
      table.index(['rfq_supplier_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
