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
 * Violation d'unicité sur l'une des contraintes nommées (`constraint` de
 * l'erreur PostgreSQL) ?
 */
export function isUniqueViolationOn(error: unknown, constraints: readonly string[]): boolean {
  if (!isUniqueViolation(error)) return false
  const constraint = (error as { constraint?: unknown }).constraint
  return typeof constraint === 'string' && constraints.includes(constraint)
}

/**
 * Exécute `run`, puis le rejoue une fois s'il échoue sur une violation
 * d'unicité de l'une des `constraints` (écriture concurrente entre une lecture
 * et l'insertion). Toute autre erreur, une violation d'une autre contrainte
 * (qui échouerait de nouveau) ou un second échec est propagé.
 */
export async function retryOnceOnUniqueViolation<T>(
  run: () => Promise<T>,
  constraints: readonly string[]
): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (!isUniqueViolationOn(error, constraints)) throw error
    return run()
  }
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
