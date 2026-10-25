import { BaseSchema } from '@adonisjs/lucid/schema'

// Liste figée : une migration décrit le schéma tel qu'à sa date.
const STATUSES = ['pending', 'confirmed', 'in_production', 'shipped', 'delivered', 'cancelled']

/**
 * Commandes (#6), créées à l'acceptation d'un devis.
 *
 * - `quote_id` est **unique** : un devis accepté donne exactement une commande,
 *   ce qui rend la création idempotente (un événement rejoué ne la double pas) ;
 * - acheteur et fournisseur sont des organisations ;
 * - les adresses sont des **copies figées** (`jsonb`) : modifier plus tard
 *   l'adresse de l'organisation ne réécrit pas une commande passée ;
 * - `total_amount` reprend le total du devis ;
 * - une colonne horodatée par statut atteint alimente la frise de l'écran ;
 * - `RESTRICT` sur le devis : on ne supprime pas, par cascade, un devis qui a
 *   donné lieu à une commande.
 */
export default class extends BaseSchema {
  protected tableName = 'orders'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('quote_id')
        .unsigned()
        .notNullable()
        .unique()
        .references('id')
        .inTable('quotes')
        .onDelete('RESTRICT')
      table
        .integer('buyer_organization_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      table
        .integer('supplier_organization_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      table.enum('status', STATUSES).notNullable().defaultTo('pending')
      table.jsonb('shipping_address').nullable()
      table.jsonb('billing_address').nullable()
      table.decimal('total_amount', 14, 2).notNullable().defaultTo(0)
      table.specificType('currency', 'char(3)').notNullable().defaultTo('EUR')
      table.timestamp('confirmed_at').nullable()
      table.timestamp('in_production_at').nullable()
      table.timestamp('shipped_at').nullable()
      table.timestamp('delivered_at').nullable()
      table.timestamp('cancelled_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['buyer_organization_id', 'status'])
      table.index(['supplier_organization_id', 'status'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
