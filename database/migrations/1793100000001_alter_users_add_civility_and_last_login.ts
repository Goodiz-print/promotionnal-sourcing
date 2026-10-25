import { BaseSchema } from '@adonisjs/lucid/schema'
import { CIVILITIES } from '#shared/types/agency'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('civility', [...CIVILITIES]).nullable()
      table.timestamp('last_login_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('last_login_at')
      table.dropColumn('civility')
    })
  }
}
