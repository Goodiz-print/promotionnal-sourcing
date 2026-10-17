import { BaseSchema } from '@adonisjs/lucid/schema'
import { DEFAULT_PLATFORM_ROLE, PLATFORM_ROLES } from '#shared/types/user'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .enum('platform_role', [...PLATFORM_ROLES])
        .notNullable()
        .defaultTo(DEFAULT_PLATFORM_ROLE)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('platform_role')
    })
  }
}
