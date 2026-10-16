import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Politique de traduction (#75) : chaque entité porte sa langue source
 * (`source_locale`, celle saisie par le fournisseur) et chaque ligne de
 * traduction un marqueur `is_auto` (générée par l'IA, corrigeable). Une
 * traduction saisie à la main (`is_auto = false`) n'est jamais écrasée.
 */
const ENTITY_TABLES = ['products', 'categories', 'attributes', 'attribute_values'] as const
const TRANSLATION_TABLES = [
  'product_translations',
  'category_translations',
  'attribute_translations',
  'attribute_value_translations',
] as const

export default class extends BaseSchema {
  async up() {
    for (const tableName of ENTITY_TABLES) {
      this.schema.alterTable(tableName, (table) => {
        table.string('source_locale', 10).notNullable().defaultTo('fr')
      })
    }
    for (const tableName of TRANSLATION_TABLES) {
      this.schema.alterTable(tableName, (table) => {
        table.boolean('is_auto').notNullable().defaultTo(false)
      })
    }
  }

  async down() {
    for (const tableName of TRANSLATION_TABLES) {
      this.schema.alterTable(tableName, (table) => {
        table.dropColumn('is_auto')
      })
    }
    for (const tableName of ENTITY_TABLES) {
      this.schema.alterTable(tableName, (table) => {
        table.dropColumn('source_locale')
      })
    }
  }
}
