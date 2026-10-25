import { BaseSchema } from '@adonisjs/lucid/schema'
import { CERTIFICATION_DOMAINS } from '#shared/types/certification'

/**
 * Référentiel fermé des labels de conformité produit (écart 4). Même patron que
 * les attributs : colonnes **neutres** seulement (slug, domaine, synonymes
 * d'import, langue source) ; le libellé affichable vit dans
 * `certification_translations`. `is_eco` marque les labels environnementaux qui
 * alimentent la dérivation du filtre « Éco-responsable » (`products.is_eco`).
 */
export default class extends BaseSchema {
  protected tableName = 'certifications'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('slug', 255).notNullable().unique()
      table.enum('domain', [...CERTIFICATION_DOMAINS]).notNullable()
      // Un label éco-responsable compte pour le filtre dérivé « Éco-responsable ».
      table.boolean('is_eco').notNullable().defaultTo(false)
      // Synonymes multilingues pour le parseur d'import (ex: {GOTS, bio, organic}).
      table.specificType('synonyms', 'text[]').notNullable().defaultTo('{}')
      // Langue dans laquelle le référentiel est saisi (#75).
      table.string('source_locale', 10).notNullable().defaultTo('fr')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
