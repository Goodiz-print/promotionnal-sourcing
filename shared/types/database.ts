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

/**
 * Requête `db` (Lucid) en cours de construction, telle que la composent les
 * services de lecture (`db.from(...)`, `db.query()`). Côté serveur uniquement :
 * import de type, effacé à la compilation. Les lignes sont `unknown` : chaque
 * service les convertit explicitement (`Number(...)`, `String(...)`).
 */
export type DbQuery = import('@adonisjs/lucid/types/querybuilder').DatabaseQueryBuilderContract<
  Record<string, unknown>
>
