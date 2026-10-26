import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Libellés traduits des labels de conformité (écart 4). Même patron que
 * `attribute_translations` : une ligne par (certification, locale). `is_auto`
 * marque une traduction générée par l'IA, jamais écrasée si saisie à la main.
 */
export default class extends BaseSchema {
  protected tableName = 'certification_translations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('certification_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('certifications')
        .onDelete('CASCADE')
      table.string('locale', 10).notNullable()
      table.string('name', 255).notNullable()
      table.boolean('is_auto').notNullable().defaultTo(false)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['certification_id', 'locale'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
