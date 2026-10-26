import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Référentiel fermé des techniques de marquage (écart 2, ~18 canoniques). Même
 * patron que `certifications` : colonnes **neutres** seulement (slug, famille,
 * synonymes d'import) ; le libellé affichable vit dans
 * `marking_technique_translations`. La technique de marquage n'est **pas** un
 * filtre (donnée de fiche) — pas de facette Meilisearch.
 */
export default class extends BaseSchema {
  protected tableName = 'marking_techniques'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('slug', 255).notNullable().unique()
      // Famille de procédé (impression, transfert, gravure, broderie, relief…).
      table.string('family', 255).notNullable()
      // Synonymes multilingues pour le parseur d'import (ex: {tampographie, pad printing}).
      table.specificType('synonyms', 'text[]').notNullable().defaultTo('{}')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
