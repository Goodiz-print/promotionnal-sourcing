import { BaseSchema } from '@adonisjs/lucid/schema'
import { DELIVERY_SCOPES } from '#shared/types/organization'

export default class extends BaseSchema {
  protected tableName = 'supplier_profiles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('organization_id')
        .unsigned()
        .notNullable()
        .unique()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      table.integer('min_order_quantity').unsigned().nullable()
      table.integer('delivery_days').unsigned().nullable()
      table.enum('delivery_scope', [...DELIVERY_SCOPES]).nullable()
      table.specificType('certifications', 'text[]').nullable()
      table.text('bio').nullable()
      table.integer('response_time_days').unsigned().nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
