import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'suppliers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('name', 255).notNullable()
      table.string('slug', 255).notNullable().unique()
      table.string('country', 2).notNullable().defaultTo('FR')
      table.string('website', 500).nullable()
      table.string('email', 254).nullable()
      table.string('phone', 30).nullable()
      table.text('description').nullable()
      table.string('logo_url', 500).nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
