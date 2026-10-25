import SearchEngine from '#services/search/search_engine'
import type { ProductSearchDocument } from '#shared/types/search'

/**
 * Moteur inerte, lié quand `MEILISEARCH_HOST` est absent (dev, test, CI) : rien
 * n'est indexé, rien n'est appelé.
 */
export default class NullSearchEngine extends SearchEngine {
  readonly enabled = false

  async upsert(_documents: ProductSearchDocument[]): Promise<void> {}

  async remove(_ids: number[]): Promise<void> {}

  async replaceAll(batches: AsyncIterable<ProductSearchDocument[]>): Promise<number> {
    // Consomme le flux pour rester symétrique du vrai moteur (compte les documents).
    let count = 0
    for await (const batch of batches) count += batch.length
    return count
  }
}
