/**
 * Sérialise un vecteur JS en littéral pgvector (`[0.1,0.2,…]`), destiné à être
 * casté en `?::halfvec` dans une requête SQL paramétrée.
 */
export function toPgVector(vector: number[]): string {
  return `[${vector.join(',')}]`
}
