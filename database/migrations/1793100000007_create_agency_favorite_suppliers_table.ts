import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Fournisseurs favoris d'une agence (raccourcis de recherche, construits à l'usage).
 */
export default class extends BaseSchema {
  protected tableName = 'agency_favorite_suppliers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table
        .integer('organization_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      table
        .integer('supplier_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('suppliers')
        .onDelete('CASCADE')
      table.timestamp('created_at').notNullable()
      table.primary(['organization_id', 'supplier_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
