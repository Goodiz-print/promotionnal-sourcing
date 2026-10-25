import searchConfig from '#config/search'

interface Entry {
  vector: number[]
  expiresAt: number
}

/**
 * Cache des vecteurs de requête (ADR 0002, décision 7) : une recherche déjà vue
 * — typiquement la page 2 d'une liste, ou la même requête d'un autre acheteur —
 * ne repaie pas un appel au provider d'embeddings.
 *
 * Mémoire du **processus** (singleton, cf. `providers/search_provider.ts`) : un
 * redémarrage ou un autre worker repart à froid, ce qui coûte un appel de plus,
 * jamais une erreur. La clé vient de l'appelant et doit inclure provider et
 * modèle (`EmbeddingService#embeddingKey`) : un vecteur n'est valable que pour
 * le modèle qui l'a produit. Éviction : la plus ancienne entrée (ordre
 * d'insertion de `Map`) quand `maxEntries` est atteint.
 */
export default class QueryVectorCache {
  #entries = new Map<string, Entry>()

  get(key: string, now = Date.now()): number[] | null {
    const entry = this.#entries.get(key)
    if (!entry) return null
    if (entry.expiresAt <= now) {
      this.#entries.delete(key)
      return null
    }
    return entry.vector
  }

  set(key: string, vector: number[], now = Date.now()): void {
    const { ttlMs, maxEntries } = searchConfig.queryVectorCache
    this.#entries.delete(key)
    this.#entries.set(key, { vector, expiresAt: now + ttlMs })

    while (this.#entries.size > maxEntries) {
      const oldest = this.#entries.keys().next().value
      if (oldest === undefined) break
      this.#entries.delete(oldest)
    }
  }

  clear(): void {
    this.#entries.clear()
  }

  get size(): number {
    return this.#entries.size
  }
}
