import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'attribute_values'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('attribute_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('attributes')
        .onDelete('CASCADE')
      // Valeur canonique (ex: 'blue') utilisee pour le filtrage ET fiable
      table.string('value', 255).notNullable()
      // Libelle affichable (ex: 'Bleu')
      table.string('label', 255).notNullable()
      table.string('slug', 255).notNullable()
      // Synonymes multilingues pour le parseur (ex: {bleu, blue, azur})
      table.specificType('synonyms', 'text[]').notNullable().defaultTo('{}')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['attribute_id', 'slug'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
