import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Politique de traduction (#75) :
 * - `source_locale` : langue dans laquelle le fournisseur a saisi le contenu.
 *   Tout le reste est traduit à partir de cette langue. Défaut `fr` pour les
 *   lignes existantes (la saisie était bilingue fr / en, fr faisait foi).
 * - `is_auto` sur les traductions : `true` si la ligne a été générée par Mistral,
 *   `false` si elle a été saisie à la main. Une ligne saisie à la main n'est
 *   jamais écrasée par la traduction automatique. Défaut `false` : les lignes
 *   existantes sont considérées comme saisies.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('products', (table) => {
      table.string('source_locale', 10).notNullable().defaultTo('fr')
    })
    this.schema.alterTable('categories', (table) => {
      table.string('source_locale', 10).notNullable().defaultTo('fr')
    })
    this.schema.alterTable('product_translations', (table) => {
      table.boolean('is_auto').notNullable().defaultTo(false)
    })
    this.schema.alterTable('category_translations', (table) => {
      table.boolean('is_auto').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable('category_translations', (table) => {
      table.dropColumn('is_auto')
    })
    this.schema.alterTable('product_translations', (table) => {
      table.dropColumn('is_auto')
    })
    this.schema.alterTable('categories', (table) => {
      table.dropColumn('source_locale')
    })
    this.schema.alterTable('products', (table) => {
      table.dropColumn('source_locale')
    })
  }
}
