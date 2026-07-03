import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'products'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('supplier_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('suppliers')
        .onDelete('CASCADE')
      table
        .integer('category_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('categories')
        .onDelete('RESTRICT')
      table.string('name', 255).notNullable()
      table.string('slug', 255).notNullable().unique()
      table.string('reference', 100).nullable()
      table.text('description').nullable()
      table.decimal('price_min', 12, 2).nullable()
      table.decimal('price_max', 12, 2).nullable()
      table.string('currency', 3).notNullable().defaultTo('EUR')
      table.integer('min_quantity').unsigned().nullable()
      table.string('image_url', 500).nullable()
      table.string('origin_country', 2).nullable()
      table.boolean('made_in_europe').notNullable().defaultTo(false)
      table.boolean('is_active').notNullable().defaultTo(true)

      // Vectorisation : embedding Mistral (mistral-embed = 1024 dims),
      // peuple par un job asynchrone dans un prochain incrément.
      table.specificType('embedding', 'vector(1024)').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['supplier_id'])
      table.index(['category_id'])
      table.index(['origin_country'])
      table.index(['is_active'])
    })

    if (this.db.dialect.name === 'postgres') {
      // Full-text search : colonne generee immuable (config 'french').
      // unaccent() est STABLE et ne peut pas figurer dans une colonne
      // GENERATED ; on l'appliquera cote requete (extension deja installee).
      this.schema.raw(
        `ALTER TABLE ${this.tableName} ADD COLUMN search_vector tsvector ` +
          `GENERATED ALWAYS AS (` +
          `to_tsvector('french', coalesce(name, '') || ' ' || coalesce(description, ''))` +
          `) STORED`
      )
      this.schema.raw(
        `CREATE INDEX products_search_vector_idx ON ${this.tableName} USING gin (search_vector)`
      )
      // Index HNSW pour la recherche par similarite cosinus sur l'embedding.
      this.schema.raw(
        `CREATE INDEX products_embedding_idx ON ${this.tableName} ` +
          `USING hnsw (embedding vector_cosine_ops)`
      )
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
