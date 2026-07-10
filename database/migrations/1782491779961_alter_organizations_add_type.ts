import { BaseSchema } from '@adonisjs/lucid/schema'
import { ORGANIZATION_TYPES, DEFAULT_ORGANIZATION_KIND } from '#shared/types/organization'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('organizations', (table) => {
      table
        .enum('organization_type', [...ORGANIZATION_TYPES])
        .notNullable()
        .defaultTo(DEFAULT_ORGANIZATION_KIND)
    })
  }

  async down() {
    this.schema.alterTable('organizations', (table) => {
      table.dropColumn('organization_type')
    })
  }
}
