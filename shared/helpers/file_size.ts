const UNITS = ['B', 'KB', 'MB', 'GB'] as const

/**
 * Taille lisible d'un fichier (unités 1024, une décimale au-delà de l'octet) :
 * `formatFileSize(1_572_864)` → `1.5 MB`.
 */
export function formatFileSize(bytes: number): string {
  let value = Math.max(0, bytes)
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit++
  }
  return unit === 0 ? `${value} ${UNITS[0]}` : `${value.toFixed(1)} ${UNITS[unit]}`
}
