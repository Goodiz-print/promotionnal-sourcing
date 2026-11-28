/**
 * Avancement en pourcentage entier (0-100) : `null` si le total est inconnu,
 * 100 si le total est nul (rien à traiter), plafonné à 100.
 */
export function progressPercent(processed: number, total: number | null): number | null {
  if (total === null) return null
  if (total === 0) return 100
  return Math.min(100, Math.round((processed / total) * 100))
}
