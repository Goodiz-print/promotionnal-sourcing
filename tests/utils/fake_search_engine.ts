import app from '@adonisjs/core/services/app'
import searchConfig from '#config/search'
import SearchEngine from '#services/search/search_engine'
import type {
  ProductSearchDocument,
  ProductSearchHits,
  ProductSearchRequest,
} from '#shared/types/search'

/**
 * Moteur de recherche factice : enregistre ce que l'application lui envoie et
 * répond ce qu'on lui a dit de répondre. Sert à vérifier le code applicatif
 * (synchronisation, recherche, rechargement) sans Meilisearch.
 */
export default class FakeSearchEngine extends SearchEngine {
  enabled = true
  upserted: ProductSearchDocument[][] = []
  removed: number[][] = []
  replaced: ProductSearchDocument[][] = []
  requests: ProductSearchRequest[] = []
  /** Réponse de `search` ; `Error` pour simuler un moteur injoignable. */
  hits: ProductSearchHits | Error = { ids: [], total: 0 }
  /** Simule une API d'embeddings indisponible : seules les requêtes sémantiques échouent. */
  failSemantic = false

  async upsert(documents: ProductSearchDocument[]) {
    if (documents.length > 0) this.upserted.push(documents)
  }

  async remove(ids: number[]) {
    if (ids.length > 0) this.removed.push(ids)
  }

  async search(request: ProductSearchRequest): Promise<ProductSearchHits> {
    this.requests.push(request)
    if (this.failSemantic && request.semanticRatio > 0) throw new Error('embedding API unavailable')
    if (this.hits instanceof Error) throw this.hits
    return this.hits
  }

  async replaceAll(batches: AsyncIterable<ProductSearchDocument[]>) {
    let count = 0
    for await (const batch of batches) {
      this.replaced.push(batch)
      count += batch.length
    }
    return count
  }

  get indexedIds(): number[] {
    return this.upserted.flat().map((document) => document.id)
  }
}

/** État à restaurer après un test qui bascule le moteur. */
export interface FakeEngineHandle {
  engine: FakeSearchEngine
  restore(): void
}

/**
 * Active (ou désactive) la recherche avec un moteur factice. À restaurer en fin
 * de test — dans un hook de groupe, `restore` est renvoyé par `each.setup`.
 */
export function installFakeEngine(enabled = true): FakeEngineHandle {
  const engine = new FakeSearchEngine()
  engine.enabled = enabled
  const previous = { enabled: searchConfig.enabled, batchSize: searchConfig.batchSize }
  searchConfig.enabled = enabled
  app.container.swap(SearchEngine, () => engine)

  return {
    engine,
    restore() {
      searchConfig.enabled = previous.enabled
      searchConfig.batchSize = previous.batchSize
      app.container.restore(SearchEngine)
    },
  }
}
