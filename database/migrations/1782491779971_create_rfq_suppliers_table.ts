import { BaseSchema } from '@adonisjs/lucid/schema'
import { DEFAULT_RFQ_SUPPLIER_STATUS, RFQ_SUPPLIER_STATUSES } from '#shared/types/rfq'

export default class extends BaseSchema {
  protected tableName = 'rfq_suppliers'

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
      // Un fournisseur est une **organisation** de type `supplier`/`both`
      // (décision actée en #3), pas une fiche catalogue `suppliers` : ses
      // utilisateurs se connectent pour consulter la demande et y répondre.
      table
        .integer('supplier_organization_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      table
        .enum('status', [...RFQ_SUPPLIER_STATUSES])
        .notNullable()
        .defaultTo(DEFAULT_RFQ_SUPPLIER_STATUS)
      table.timestamp('sent_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Un fournisseur n'est destinataire qu'une fois par demande.
      table.unique(['rfq_id', 'supplier_organization_id'])
      // Écran « demandes reçues » du fournisseur.
      table.index(['supplier_organization_id', 'status'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
