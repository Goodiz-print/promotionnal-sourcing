import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'product_translations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('product_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('products')
        .onDelete('CASCADE')
      table.string('locale', 10).notNullable()
      table.string('name', 255).notNullable()
      table.text('description').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['product_id', 'locale'])
      table.index(['locale'])
    })

    if (this.db.dialect.name === 'postgres') {
      // Full-text par langue : colonne generee immuable. Chaque branche du
      // CASE est un to_tsvector(<config litterale>, ...) => immuable (pas de
      // cast ::regconfig dynamique). Fallback 'simple' pour toute locale non
      // mappee. Ajouter une langue = ajouter une branche WHEN (cf.
      // LOCALE_TSCONFIG dans shared/types/i18n.ts).
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

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
