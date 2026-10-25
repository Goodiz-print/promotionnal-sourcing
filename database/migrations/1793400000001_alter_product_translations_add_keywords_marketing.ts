import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Mots-clés et arguments marketing **par locale** (écart 5) : portés par la
 * traduction, pas par le produit, car ils sont rédigés dans chaque langue.
 */
export default class extends BaseSchema {
  protected tableName = 'product_translations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.specificType('keywords', 'text[]').nullable()
      table.specificType('marketing_points', 'text[]').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumns('keywords', 'marketing_points')
    })
  }
}
