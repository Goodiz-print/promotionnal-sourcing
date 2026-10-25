import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'category_attributes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('category_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('categories')
        .onDelete('CASCADE')
      table
        .integer('attribute_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('attributes')
        .onDelete('CASCADE')
      // Garde de publication : sans cette donnee, la fiche de cette categorie
      // (et de ses descendantes) n'est pas publiable (classeur « Obligatoire »).
      table.boolean('is_required_for_publication').notNullable().defaultTo(false)
      // La facette apparait dans la barre de filtres de la categorie
      // (classeur « Sert de filtre »).
      table.boolean('is_filter').notNullable().defaultTo(false)
      // Ordre d'affichage dans le bloc de filtres de la categorie.
      table.integer('position').notNullable().defaultTo(0)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Un attribut n'est rattache qu'une fois a une categorie donnee.
      table.unique(['category_id', 'attribute_id'])
      // Resolution des facettes d'une categorie (service CatalogueFacets).
      table.index(['category_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
