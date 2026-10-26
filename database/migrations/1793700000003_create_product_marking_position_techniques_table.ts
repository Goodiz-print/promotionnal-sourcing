import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Techniques de marquage possibles par position (écart 2) : nombre de couleurs
 * max et frais techniques (setup) propres au couple (position, technique). Une
 * technique au plus une fois par position.
 */
export default class extends BaseSchema {
  protected tableName = 'product_marking_position_techniques'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('marking_position_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('product_marking_positions')
        .onDelete('CASCADE')
      table
        .integer('marking_technique_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('marking_techniques')
      table.integer('max_colors').unsigned().nullable()
      table.decimal('default_setup_charge', 12, 4).nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['marking_position_id', 'marking_technique_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
