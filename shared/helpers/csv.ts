/** Séparateur des exports : `;`, celui qu'Excel attend en configuration française. */
export const CSV_SEPARATOR = ';'

/**
 * Échappe une cellule CSV (RFC 4180) et neutralise les formules : une valeur
 * saisie par un fournisseur ne doit jamais être interprétée comme une formule
 * Excel (`=`, `+`, `-`, `@` en tête, ou tabulation / retour chariot).
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  let text = String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  if (/[";\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

/** Une ligne CSV à partir de ses cellules, sans fin de ligne. */
export function csvLine(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvCell).join(CSV_SEPARATOR)
}
