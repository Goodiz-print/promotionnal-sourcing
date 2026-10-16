import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Clés d'idempotence des appels IA (Mistral) : un job relancé sans changement de
 * source n'appelle pas l'API (ni ne refacture). La clé est stockée sur la ligne
 * qu'elle protège.
 */
const TRANSLATION_TABLES = [
  'product_translations',
  'category_translations',
  'attribute_translations',
  'attribute_value_translations',
] as const

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('products', (table) => {
      table.string('embedding_key', 64).nullable()
    })
    for (const tableName of TRANSLATION_TABLES) {
      this.schema.alterTable(tableName, (table) => {
        table.string('translation_key', 64).nullable()
      })
    }
  }

  async down() {
    for (const tableName of TRANSLATION_TABLES) {
      this.schema.alterTable(tableName, (table) => {
        table.dropColumn('translation_key')
      })
    }
    this.schema.alterTable('products', (table) => {
      table.dropColumn('embedding_key')
    })
  }
}
