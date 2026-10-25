import { BaseSchema } from '@adonisjs/lucid/schema'

// Liste figée : une migration décrit le schéma tel qu'à sa date.
const STATUSES = ['draft', 'submitted', 'accepted', 'rejected', 'expired']

/**
 * Devis d'un fournisseur en réponse à une demande (#5).
 *
 * - un devis est rattaché à la demande **et** à l'organisation fournisseuse ;
 * - `total_amount` est dénormalisé (somme des lignes), recalculé côté serveur à
 *   chaque enregistrement — jamais fourni par le client ;
 * - un fournisseur n'a qu'**un** devis vivant par demande (`draft`, `submitted`
 *   ou `accepted`) : l'index unique partiel laisse un devis `rejected` ou
 *   `expired` libérer la place — après une réouverture de la demande par
 *   exemple.
 */
export default class extends BaseSchema {
  protected tableName = 'quotes'

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
        .integer('supplier_organization_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      table.enum('status', STATUSES).notNullable().defaultTo('draft')
      table.date('valid_until').nullable()
      table.text('notes').nullable()
      table.decimal('total_amount', 14, 2).notNullable().defaultTo(0)
      table.specificType('currency', 'char(3)').notNullable().defaultTo('EUR')
      table.timestamp('submitted_at').nullable()
      table.timestamp('decided_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['rfq_id', 'status'])
      table.index(['supplier_organization_id', 'status'])
    })

    this.schema.raw(
      `CREATE UNIQUE INDEX quotes_one_live_per_supplier ON ${this.tableName} (rfq_id, supplier_organization_id) WHERE status IN ('draft', 'submitted', 'accepted')`
    )
  }

  async down() {
    this.schema.raw('DROP INDEX IF EXISTS quotes_one_live_per_supplier')
    this.schema.dropTable(this.tableName)
  }
}
