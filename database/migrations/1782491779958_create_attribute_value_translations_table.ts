import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'attribute_value_translations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('attribute_value_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('attribute_values')
        .onDelete('CASCADE')
      table.string('locale', 10).notNullable()
      table.string('label', 255).notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['attribute_value_id', 'locale'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
