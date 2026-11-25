import type { ConcurrentIndex } from '../types/database.js'

/** SQLSTATE PostgreSQL d'une violation de contrainte d'unicité. */
const UNIQUE_VIOLATION = '23505'

/**
 * L'erreur est-elle une violation d'unicité PostgreSQL ? Sert aux écritures
 * idempotentes qui s'appuient sur un index unique plutôt que sur un verrou.
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  )
}

/**
 * `CREATE INDEX CONCURRENTLY` de l'index. `IF NOT EXISTS` rend la migration
 * rejouable ; un index **invalide** laissé par un échec doit avoir été retiré
 * avant (`dropIndexConcurrentlySql`), sinon il serait conservé tel quel.
 */
export function createIndexConcurrentlySql(index: ConcurrentIndex): string {
  const kind = index.unique ? 'UNIQUE INDEX' : 'INDEX'
  const where = index.where ? ` WHERE ${index.where}` : ''
  return `CREATE ${kind} CONCURRENTLY IF NOT EXISTS ${index.name} ON ${index.table} (${index.columns})${where}`
}

/** Retrait de l'index sans bloquer les écritures de sa table. */
export function dropIndexConcurrentlySql(name: string): string {
  return `DROP INDEX CONCURRENTLY IF EXISTS ${name}`
}
