import { BaseSchema } from '@adonisjs/lucid/schema'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '#shared/types/i18n'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('users', (table) => {
      table
        .enum('locale', [...SUPPORTED_LOCALES])
        .notNullable()
        .defaultTo(DEFAULT_LOCALE)
    })
  }

  async down() {
    this.schema.alterTable('users', (table) => {
      table.dropColumn('locale')
    })
  }
}
