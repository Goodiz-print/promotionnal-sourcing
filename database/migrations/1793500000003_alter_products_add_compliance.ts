import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Conformité produit (écart 4) au niveau `products` :
 *
 * - `recycled_content_percent` : part de matière recyclée (0-100), saisie ;
 * - `caution_comment` : mise en garde / précaution d'emploi libre, saisie ;
 * - `is_eco` : filtre dérivé « Éco-responsable », **jamais saisi** — maintenu par
 *   le pipeline d'indexation (`ProductEcoService`, backfill `ProductIndexService`)
 *   et au save produit. Vrai si `recycled_content_percent > 0`, OU matière
 *   éco-responsable (bio/recyclé/naturel), OU au moins un label éco.
 */
export default class extends BaseSchema {
  protected tableName = 'products'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('recycled_content_percent').unsigned().nullable()
      table.text('caution_comment').nullable()
      // Colonne dérivée (jamais saisie) — alimente la facette Meilisearch `isEco`.
      table.boolean('is_eco').notNullable().defaultTo(false)
      table.index(['is_eco'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['is_eco'])
      table.dropColumns('recycled_content_percent', 'caution_comment', 'is_eco')
    })
  }
}
