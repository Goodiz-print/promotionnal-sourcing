import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'organizations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('name', 255).notNullable()
      table.string('slug', 255).notNullable().unique()
      table.string('siret', 14).nullable()
      table.string('vat_number', 30).nullable()
      table.string('email', 254).nullable()
      table.string('phone', 30).nullable()
      table.string('website', 500).nullable()
      table.string('industry', 100).nullable()
      table.enu('size', ['micro', 'small', 'medium', 'large', 'enterprise']).nullable()
      table.text('description').nullable()
      table.string('logo_url', 500).nullable()
      table.string('address_line1', 255).nullable()
      table.string('address_line2', 255).nullable()
      table.string('city', 100).nullable()
      table.string('postal_code', 10).nullable()
      table.string('country', 2).notNullable().defaultTo('FR')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
