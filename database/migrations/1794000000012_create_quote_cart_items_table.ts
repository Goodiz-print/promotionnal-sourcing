import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Panier de devis : produits qu'un acheteur met de côté avant de les demander.
 * Une ligne par (utilisateur, organisation, produit) — pas d'en-tête de panier,
 * il n'y aurait rien à y stocker. À la validation, les lignes deviennent une
 * demande de devis par fournisseur (cf. `QuoteCartService#checkout`).
 */
export default class extends BaseSchema {
  protected tableName = 'quote_cart_items'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      // Le panier vit dans l'organisation courante : changer d'organisation
      // change de panier, les demandes créées appartiennent à celle-ci.
      table
        .integer('organization_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      // `CASCADE` et non `SET NULL` (comme `rfq_items`) : rien n'a encore été
      // envoyé, un produit retiré du catalogue quitte simplement le panier.
      table
        .integer('product_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('products')
        .onDelete('CASCADE')
      table.integer('quantity').unsigned().notNullable()
      table.text('note').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Un produit n'est qu'une fois au panier : on en modifie la quantité.
      table.unique(['user_id', 'organization_id', 'product_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
