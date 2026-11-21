/**
 * Index construit `CONCURRENTLY` par une migration (`createIndexConcurrently`,
 * `database/concurrent_index.ts`) : la table reste ouverte en écriture pendant
 * la construction.
 */
export interface ConcurrentIndex {
  name: string
  table: string
  /** Colonnes ou expressions indexées, telles qu'écrites entre parenthèses. */
  columns: string
  /** Prédicat d'un index partiel. */
  where?: string
  unique?: boolean
}
