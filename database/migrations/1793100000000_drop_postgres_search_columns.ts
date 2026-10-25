import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * ADR 0002 (décision 13) : la recherche vit dans Meilisearch, qui calcule et garde
 * les vecteurs. Retire ce que PostgreSQL ne sert plus :
 *
 * - `products.embedding` (halfvec) et `products.embedding_key`, avec l'index HNSW
 *   `products_embedding_idx` ;
 * - `product_translations.search_vector` (tsvector par langue) et ses index GIN (supprimés avec leur colonne).
 *
 * L'extension `vector` reste installée : les anciennes migrations la créent et
 * `down()` recrée la colonne. `down()` ne restitue pas les données (colonnes
 * recalculables : `search:reindex` pour les vecteurs, ré-écriture de la traduction
 * pour le tsvector).
 */
export default class extends BaseSchema {
  async up() {
    if (this.db.dialect.name !== 'postgres') return

    // Supprimer la colonne supprime aussi ses index (HNSW, GIN par locale).
    this.schema.alterTable('products', (table) => {
      table.dropColumn('embedding')
      table.dropColumn('embedding_key')
    })

    this.schema.alterTable('product_translations', (table) => {
      table.dropColumn('search_vector')
    })
  }

  async down() {
    if (this.db.dialect.name !== 'postgres') return

    this.schema.raw('ALTER TABLE product_translations ADD COLUMN search_vector tsvector')
    this.schema.raw(
      'CREATE INDEX product_translations_search_vector_idx ON product_translations USING gin (search_vector)'
    )

    this.schema.alterTable('products', (table) => {
      table.string('embedding_key', 64).nullable()
    })
    this.schema.raw('ALTER TABLE products ADD COLUMN embedding halfvec(1024)')
    this.schema.raw(
      'CREATE INDEX products_embedding_idx ON products USING hnsw (embedding halfvec_cosine_ops)'
    )
  }
}
