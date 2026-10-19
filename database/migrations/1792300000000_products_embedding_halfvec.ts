import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `products.embedding` : `vector(1024)` (float32, ~4 Ko/ligne) → `halfvec(1024)`
 * (float16, ~2 Ko/ligne). Stockage et index HNSW divisés par ~2 (#71, mesures dans
 * `docs/catalogue.md`). À jouer avant le remplissage en masse : la conversion
 * réécrit la table et reconstruit l'index.
 */
export default class extends BaseSchema {
  protected tableName = 'products'

  async up() {
    if (this.db.dialect.name !== 'postgres') return
    this.schema.raw('DROP INDEX IF EXISTS products_embedding_idx')
    this.schema.raw(
      `ALTER TABLE ${this.tableName} ALTER COLUMN embedding TYPE halfvec(1024) USING embedding::halfvec(1024)`
    )
    this.schema.raw(
      `CREATE INDEX products_embedding_idx ON ${this.tableName} USING hnsw (embedding halfvec_cosine_ops)`
    )
  }

  async down() {
    if (this.db.dialect.name !== 'postgres') return
    this.schema.raw('DROP INDEX IF EXISTS products_embedding_idx')
    this.schema.raw(
      `ALTER TABLE ${this.tableName} ALTER COLUMN embedding TYPE vector(1024) USING embedding::vector(1024)`
    )
    this.schema.raw(
      `CREATE INDEX products_embedding_idx ON ${this.tableName} USING hnsw (embedding vector_cosine_ops)`
    )
  }
}
