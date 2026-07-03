import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'product_attributes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('product_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('products')
        .onDelete('CASCADE')
      table
        .integer('attribute_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('attributes')
        .onDelete('CASCADE')
      // Nullable : les attributs numeriques libres (grammage) n'ont pas de
      // valeur enumeree et s'appuient sur value_number.
      table
        .integer('attribute_value_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('attribute_values')
        .onDelete('CASCADE')
      table.decimal('value_number', 12, 2).nullable()
      table.string('value_string', 255).nullable()
      // Default DB : le pivot est alimente via sync() (pivotTimestamps: false)
      // et potentiellement en insert brut/bulk lors des imports catalogue.
      table.timestamp('created_at').notNullable().defaultTo(this.now())
      table.timestamp('updated_at').nullable()

      table.unique(['product_id', 'attribute_id', 'attribute_value_id'])
      // Filtrage a facettes : (attribut, valeur) -> produits (le ET fiable)
      table.index(['attribute_id', 'attribute_value_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
