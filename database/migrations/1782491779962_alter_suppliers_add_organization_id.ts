import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('suppliers', (table) => {
      table
        .integer('organization_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('organizations')
        .onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable('suppliers', (table) => {
      table.dropColumn('organization_id')
    })
  }
}
