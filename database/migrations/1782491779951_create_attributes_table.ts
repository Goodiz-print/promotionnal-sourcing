import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'attributes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('name', 255).notNullable()
      table.string('slug', 255).notNullable().unique()
      table.enu('type', ['string', 'number', 'boolean', 'enum']).notNullable().defaultTo('enum')
      table.string('unit', 30).nullable()
      table.boolean('is_filterable').notNullable().defaultTo(true)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
