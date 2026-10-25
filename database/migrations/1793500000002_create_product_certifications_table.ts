import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Pivot produit ↔ label de conformité (écart 4) : les certifications **au niveau
 * produit** (le profil fournisseur garde son `supplier_profiles.certifications
 * text[]`, inchangé). Clé primaire composite — un label n'est rattaché qu'une
 * fois à un produit —, pas de colonnes additionnelles. L'index sur
 * `certification_id` sert les requêtes « produits portant ce label ».
 */
export default class extends BaseSchema {
  protected tableName = 'product_certifications'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table
        .integer('product_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('products')
        .onDelete('CASCADE')
      table
        .integer('certification_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('certifications')
        .onDelete('CASCADE')

      table.primary(['product_id', 'certification_id'])
      table.index(['certification_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
