import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Deplace tout le texte du catalogue vers les tables de traduction : on
 * retire les colonnes traduites des tables de base (elles ne gardent que les
 * colonnes neutres : slugs, value canonique, unit, synonyms, prix, flags,
 * embedding).
 */
export default class extends BaseSchema {
  async up() {
    // products : la colonne generee search_vector depend de name/description,
    // on la supprime (avec son index) avant de retirer les colonnes texte.
    if (this.db.dialect.name === 'postgres') {
      this.schema.raw('DROP INDEX IF EXISTS products_search_vector_idx')
      this.schema.raw('ALTER TABLE products DROP COLUMN IF EXISTS search_vector')
    }

    this.schema.alterTable('products', (table) => {
      table.dropColumn('name')
      table.dropColumn('description')
    })
    this.schema.alterTable('categories', (table) => {
      table.dropColumn('name')
      table.dropColumn('description')
    })
    this.schema.alterTable('attributes', (table) => {
      table.dropColumn('name')
    })
    this.schema.alterTable('attribute_values', (table) => {
      table.dropColumn('label')
    })
    this.schema.alterTable('suppliers', (table) => {
      table.dropColumn('name')
      table.dropColumn('description')
    })
  }

  async down() {
    // Reversibilite best-effort : recree les colonnes (nullable pour eviter les
    // violations NOT NULL sur d'eventuelles lignes existantes) et la colonne
    // generee FR de products.
    this.schema.alterTable('suppliers', (table) => {
      table.string('name', 255).nullable()
      table.text('description').nullable()
    })
    this.schema.alterTable('attribute_values', (table) => {
      table.string('label', 255).nullable()
    })
    this.schema.alterTable('attributes', (table) => {
      table.string('name', 255).nullable()
    })
    this.schema.alterTable('categories', (table) => {
      table.string('name', 255).nullable()
      table.text('description').nullable()
    })
    this.schema.alterTable('products', (table) => {
      table.string('name', 255).nullable()
      table.text('description').nullable()
    })

    if (this.db.dialect.name === 'postgres') {
      this.schema.raw(
        `ALTER TABLE products ADD COLUMN search_vector tsvector ` +
          `GENERATED ALWAYS AS (` +
          `to_tsvector('french', coalesce(name, '') || ' ' || coalesce(description, ''))` +
          `) STORED`
      )
      this.schema.raw(
        `CREATE INDEX products_search_vector_idx ON products USING gin (search_vector)`
      )
    }
  }
}
