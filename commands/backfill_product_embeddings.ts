import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'
import GenerateProductEmbeddingJob from '#jobs/generate_product_embedding_job'

/**
 * Backfill des produits existants sans embedding : met en file un
 * GenerateProductEmbeddingJob par produit (`products.embedding IS NULL`).
 * Colonne SQL brute non typee par l'ORM (cf. database/schema_rules.ts) =>
 * lecture en raw SQL.
 */
export default class BackfillProductEmbeddings extends BaseCommand {
  static commandName = 'catalogue:backfill-embeddings'
  static description =
    "Met en file d'attente la generation d'embeddings Mistral pour les produits sans embedding"

  static options: CommandOptions = {}

  async run() {
    const result = await db.rawQuery('SELECT id FROM products WHERE embedding IS NULL ORDER BY id')
    const products = result.rows as Array<{ id: number }>

    for (const product of products) {
      await GenerateProductEmbeddingJob.dispatch({ productId: product.id })
    }

    this.logger.success(`${products.length} job(s) de generation d'embedding mis en file`)
  }
}
