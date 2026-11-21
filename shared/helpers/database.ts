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
