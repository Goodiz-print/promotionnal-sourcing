import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import ProductEmbeddingService from '#services/product_embedding_service'
import { LOCALE_TSCONFIG, DEFAULT_TSCONFIG, type Locale } from '#shared/types/i18n'
import type { ProductSearchResult } from '#shared/types/search'

const RRF_K = 60
const CANDIDATE_LIMIT = 50

interface HybridSearchRow {
  product_id: number
  score: string
}

/**
 * Recherche hybride catalogue : fusionne le classement full-text par langue
 * (`product_translations.search_vector`) et le classement par similarite
 * cosinus de l'embedding de la requete (`products.embedding`, HNSW) via
 * Reciprocal Rank Fusion (RRF) — combine deux classements sans avoir a
 * normaliser deux echelles de score incomparables (ts_rank vs distance
 * cosinus). PostgreSQL uniquement (pgvector/tsvector).
 */
@inject()
export default class ProductCatalogueService {
  constructor(private embeddingService: ProductEmbeddingService) {}

  async search(query: string, locale: Locale, limit = 20): Promise<ProductSearchResult[]> {
    const tsConfig = LOCALE_TSCONFIG[locale] ?? DEFAULT_TSCONFIG
    const queryEmbedding = await this.embeddingService.embed(query)
    const vectorLiteral = `[${queryEmbedding.join(',')}]`

    const result = await db.rawQuery(
      `
      WITH fts AS (
        SELECT pt.product_id,
               row_number() OVER (
                 ORDER BY ts_rank(pt.search_vector, plainto_tsquery(?::regconfig, ?)) DESC
               ) AS rank
        FROM product_translations pt
        WHERE pt.locale = ? AND pt.search_vector @@ plainto_tsquery(?::regconfig, ?)
        LIMIT ?
      ),
      vec AS (
        SELECT p.id AS product_id, row_number() OVER (ORDER BY p.embedding <=> ?::vector) AS rank
        FROM products p
        WHERE p.embedding IS NOT NULL AND p.is_active = true
        LIMIT ?
      )
      SELECT COALESCE(fts.product_id, vec.product_id) AS product_id,
             (COALESCE(1.0 / (? + fts.rank), 0) + COALESCE(1.0 / (? + vec.rank), 0)) AS score
      FROM fts
      FULL OUTER JOIN vec ON fts.product_id = vec.product_id
      ORDER BY score DESC
      LIMIT ?
      `,
      [
        tsConfig,
        query,
        locale,
        tsConfig,
        query,
        CANDIDATE_LIMIT,
        vectorLiteral,
        CANDIDATE_LIMIT,
        RRF_K,
        RRF_K,
        limit,
      ]
    )

    return (result.rows as HybridSearchRow[]).map((row) => ({
      productId: row.product_id,
      score: Number(row.score),
    }))
  }
}
