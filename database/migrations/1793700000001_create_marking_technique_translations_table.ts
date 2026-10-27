import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Libellés traduits des techniques de marquage (écart 2). Même patron que
 * `certification_translations` : une ligne par (technique, locale). `is_auto`
 * marque une traduction générée par l'IA, jamais écrasée si saisie à la main.
 */
export default class extends BaseSchema {
  protected tableName = 'marking_technique_translations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('marking_technique_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('marking_techniques')
        .onDelete('CASCADE')
      table.string('locale', 10).notNullable()
      table.string('name', 255).notNullable()
      table.boolean('is_auto').notNullable().defaultTo(false)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['marking_technique_id', 'locale'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
