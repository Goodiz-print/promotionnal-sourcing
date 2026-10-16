import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `search_vector` passe de colonne générée à colonne ordinaire, calculée par
 * l'application (`ProductTranslationSearchService`) avec `LOCALE_TSCONFIG`.
 * Ajouter une langue ne demande plus de réécrire la table : un index GIN
 * partiel + un backfill de ses lignes (#84).
 *
 * Valeurs figées volontairement (une migration ne doit pas dépendre du code
 * applicatif, qui évolue) : état au moment de la migration = fr / en.
 */
const LOCALES: Record<string, string> = { fr: 'french', en: 'english' }

export default class extends BaseSchema {
  protected tableName = 'product_translations'

  async up() {
    if (this.db.dialect.name !== 'postgres') return

    this.schema.raw('DROP INDEX IF EXISTS product_translations_search_vector_idx')
    this.schema.raw(`ALTER TABLE ${this.tableName} DROP COLUMN search_vector`)
    this.schema.raw(`ALTER TABLE ${this.tableName} ADD COLUMN search_vector tsvector`)

    const branches = Object.entries(LOCALES)
      .map(([locale, config]) => `WHEN '${locale}' THEN '${config}'::regconfig`)
      .join(' ')
    this.schema.raw(
      `UPDATE ${this.tableName} SET search_vector = to_tsvector(` +
        `CASE locale ${branches} ELSE 'simple'::regconfig END, ` +
        `coalesce(name, '') || ' ' || coalesce(description, ''))`
    )

    for (const locale of Object.keys(LOCALES)) {
      this.schema.raw(
        `CREATE INDEX product_translations_search_vector_${locale}_idx ` +
          `ON ${this.tableName} USING gin (search_vector) WHERE locale = '${locale}'`
      )
    }
  }

  async down() {
    if (this.db.dialect.name !== 'postgres') return

    for (const locale of Object.keys(LOCALES)) {
      this.schema.raw(`DROP INDEX IF EXISTS product_translations_search_vector_${locale}_idx`)
    }
    this.schema.raw(`ALTER TABLE ${this.tableName} DROP COLUMN search_vector`)
    this.schema.raw(
      `ALTER TABLE ${this.tableName} ADD COLUMN search_vector tsvector ` +
        `GENERATED ALWAYS AS (` +
        `CASE locale ` +
        `WHEN 'fr' THEN to_tsvector('french', coalesce(name, '') || ' ' || coalesce(description, '')) ` +
        `WHEN 'en' THEN to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '')) ` +
        `ELSE to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '')) ` +
        `END` +
        `) STORED`
    )
    this.schema.raw(
      `CREATE INDEX product_translations_search_vector_idx ON ${this.tableName} USING gin (search_vector)`
    )
  }
}
