import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Journal des mouvements d'un portefeuille publicitaire, en ajout seul :
 * recharge en ligne, ajustement manuel de l'équipe, clic facturé.
 * `external_reference` (unique) rend le crédit d'un paiement idempotent : un
 * webhook rejoué ne crédite pas deux fois.
 */
export default class extends BaseSchema {
  protected tableName = 'ad_wallet_transactions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').notNullable()
      table
        .integer('wallet_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('ad_wallets')
        .onDelete('CASCADE')
      table.string('type', 20).notNullable()
      // Signé : positif pour un crédit, négatif pour un débit.
      table.integer('amount_cents').notNullable()
      table.integer('balance_after_cents').notNullable()
      table
        .integer('campaign_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('ad_campaigns')
        .onDelete('SET NULL')
      table.string('external_reference', 255).nullable().unique()
      table.text('note').nullable()
      table
        .integer('created_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('created_at').notNullable()

      table.index(['wallet_id', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
