import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Drapeau « personnalisable » (écart 2) : le produit accepte-t-il un marquage ?
 * Défaut `false`. Le nombre de positions reste dérivé du `count` des
 * `product_marking_positions`.
 */
export default class extends BaseSchema {
  protected tableName = 'products'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('printable').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('printable')
    })
  }
}
