import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Variantes d'un produit (rouge / L…), identifiées par un SKU unique par produit.
 * L'image de la variante est facultative : si l'image est supprimée de la
 * galerie, la variante la perd (`SET NULL`) mais subsiste.
 */
export default class extends BaseSchema {
  protected tableName = 'product_variants'
  protected attributesTableName = 'product_variant_attributes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('product_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('products')
        .onDelete('CASCADE')
      table.string('sku', 100).notNullable()
      table
        .integer('image_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('product_images')
        .onDelete('SET NULL')
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['product_id', 'sku'])
      table.index('image_id')
    })

    // Pivot variante ↔ valeur d'attribut (couleur = rouge). Une seule valeur
    // par attribut et par variante (`attribute_id` dénormalisé pour l'unicité).
    this.schema.createTable(this.attributesTableName, (table) => {
      table.increments('id')
      table
        .integer('variant_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable(this.tableName)
        .onDelete('CASCADE')
      table
        .integer('attribute_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('attributes')
        .onDelete('CASCADE')
      table
        .integer('attribute_value_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('attribute_values')
        .onDelete('CASCADE')
      table.timestamp('created_at').notNullable().defaultTo(this.now())
      table.timestamp('updated_at').nullable()

      table.unique(['variant_id', 'attribute_id'])
      table.index('attribute_value_id')
    })
  }

  async down() {
    this.schema.dropTable(this.attributesTableName)
    this.schema.dropTable(this.tableName)
  }
}
