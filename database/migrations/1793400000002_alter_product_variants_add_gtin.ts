import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Code EAN/GTIN par variante (écart 5). Nullable : toutes les variantes n'en
 * ont pas forcément.
 */
export default class extends BaseSchema {
  protected tableName = 'product_variants'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('gtin', 14).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('gtin')
    })
  }
}
