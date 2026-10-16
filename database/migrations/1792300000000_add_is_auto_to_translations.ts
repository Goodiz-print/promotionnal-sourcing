import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Marquage « auto » des traductions (#75) : `is_auto` vaut `true` quand la ligne
 * a été produite par Mistral, `false` quand elle a été saisie ou corrigée par le
 * fournisseur / l'admin. Le job de traduction n'écrase jamais une ligne
 * `is_auto = false`.
 */
const TRANSLATION_TABLES = [
  'product_translations',
  'category_translations',
  'attribute_translations',
  'attribute_value_translations',
] as const

export default class extends BaseSchema {
  async up() {
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
  }
}
