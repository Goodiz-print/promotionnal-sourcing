import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'category_attribute_ranges'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('category_attribute_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('category_attributes')
        .onDelete('CASCADE')
      // Bornes d'une tranche de filtre (ex. contenance 400-600 ml). `null` =
      // borne ouverte (< 400 : min null ; > 900 : max null). Le LIBELLE N'EST
      // PAS stocke : il est rendu cote UI depuis les bornes + l'unite de
      // l'attribut + la locale.
      table.decimal('min_value', 12, 2).nullable()
      table.decimal('max_value', 12, 2).nullable()
      // Ordre d'affichage des tranches.
      table.integer('position').notNullable().defaultTo(0)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['category_attribute_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
