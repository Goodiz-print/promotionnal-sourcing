/**
 * Montants des produits sponsorisés : saisis en euros dans les formulaires,
 * stockés et calculés en **centimes entiers**.
 */
export function eurosToCents(euros: number): number {
  return Math.round(euros * 100)
}

export function centsToEuros(cents: number): number {
  return cents / 100
}
