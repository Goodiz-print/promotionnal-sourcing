import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Devis du fournisseur reçu en PDF (#224), à côté du devis structuré
 * (`quotes`) : les deux formes coexistent.
 *
 * Rattaché au destinataire (`rfq_suppliers`) et non à l'organisation, pour
 * valoir aussi pour une fiche sans compte (#218). Le fichier est celui de la
 * pièce jointe du message (`message_attachments`) : pas de seconde référence
 * de stockage. Un fournisseur peut en envoyer plusieurs : aucune unicité par
 * destinataire, le plus récent fait foi et les précédents restent en base.
 */
export default class extends BaseSchema {
  protected tableName = 'quote_documents'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('rfq_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('rfqs')
        .onDelete('CASCADE')
      table
        .integer('rfq_supplier_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('rfq_suppliers')
        .onDelete('CASCADE')
      table
        .integer('message_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('messages')
        .onDelete('CASCADE')
      table
        .integer('message_attachment_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('message_attachments')
        .onDelete('CASCADE')
      table.timestamp('received_at').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['message_attachment_id'])
      table.index(['rfq_supplier_id', 'received_at'])
      table.index(['rfq_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
