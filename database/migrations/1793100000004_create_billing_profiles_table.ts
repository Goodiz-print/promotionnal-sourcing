import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Facturation d'une organisation (fournisseur payant, agence Premium). Le moyen
 * de paiement est géré par Stripe et **jamais stocké ici** : seul l'identifiant
 * client Stripe est conservé.
 */
export default class extends BaseSchema {
  protected tableName = 'billing_profiles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('organization_id')
        .unsigned()
        .notNullable()
        .unique()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      table.string('address_line1', 255).nullable()
      table.string('address_line2', 255).nullable()
      table.string('city', 100).nullable()
      table.string('postal_code', 10).nullable()
      table.string('country', 2).nullable()
      table.string('email', 254).nullable()
      table.string('purchase_order_reference', 100).nullable()
      table.string('stripe_customer_id', 100).nullable().unique()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
