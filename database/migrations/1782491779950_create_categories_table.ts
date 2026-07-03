import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'categories'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('name', 255).notNullable()
      table.string('slug', 255).notNullable().unique()
      table
        .integer('parent_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('categories')
        .onDelete('SET NULL')
      table.text('description').nullable()
      // Synonymes utilises par le futur parseur deterministe (crayon, pencil...)
      table.specificType('synonyms', 'text[]').notNullable().defaultTo('{}')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['parent_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
