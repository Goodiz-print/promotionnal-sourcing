import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Fil d'une demande de devis pour un destinataire (#224) : les réponses reçues
 * par mail y deviennent des messages. Le fil est désigné par la ligne
 * `rfq_suppliers`, pas par l'organisation : le dispositif ne suppose ni compte
 * ni membre côté fournisseur (#218). Un seul fil par destinataire.
 */
export default class extends BaseSchema {
  protected tableName = 'conversations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('rfq_supplier_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('rfq_suppliers')
        .onDelete('SET NULL')
    })
    this.schema.raw(
      `CREATE UNIQUE INDEX conversations_one_per_rfq_supplier ON ${this.tableName} (rfq_supplier_id) WHERE rfq_supplier_id IS NOT NULL`
    )
  }

  async down() {
    this.schema.raw('DROP INDEX IF EXISTS conversations_one_per_rfq_supplier')
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('rfq_supplier_id')
    })
  }
}
