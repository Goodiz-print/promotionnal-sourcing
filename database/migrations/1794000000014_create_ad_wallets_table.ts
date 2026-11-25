import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Portefeuille publicitaire prépayé d'une organisation fournisseuse (produits
 * sponsorisés, cf. `docs/ads.md`). Un par organisation, créé à la première
 * utilisation. Le solde est en centimes ; chaque mouvement est tracé dans
 * `ad_wallet_transactions`.
 */
export default class extends BaseSchema {
  protected tableName = 'ad_wallets'

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
      table.integer('balance_cents').notNullable().defaultTo(0)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
    // Garde-fou : un débit concurrent ne peut pas rendre le solde négatif.
    this.schema.raw(
      'ALTER TABLE ad_wallets ADD CONSTRAINT ad_wallets_balance_not_negative CHECK (balance_cents >= 0)'
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
