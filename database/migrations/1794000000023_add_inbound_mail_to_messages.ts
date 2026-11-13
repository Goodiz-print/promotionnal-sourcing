import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Message né d'un mail entrant (#224). L'unicité de `inbound_mail_id` est la
 * garde d'idempotence : `InboundMailReceived` est émis au moins une fois, un
 * mail ne donne jamais deux messages. Un tel message n'a pas d'auteur
 * (`author_user_id` nul) : l'expéditeur est celui du mail.
 */
export default class extends BaseSchema {
  protected tableName = 'messages'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('inbound_mail_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('inbound_mails')
        .onDelete('SET NULL')
      table.unique(['inbound_mail_id'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['inbound_mail_id'])
      table.dropColumn('inbound_mail_id')
    })
  }
}
