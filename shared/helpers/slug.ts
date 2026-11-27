/**
 * Utilitaires purs de calcul de slug unique.
 */

/** Longueur de la colonne `products.slug`. */
export const SLUG_MAX_LENGTH = 255

/** Place réservée au suffixe `-N` d'un slug (jusqu'à 7 chiffres). */
export const SLUG_SUFFIX_ROOM = 8

/**
 * Base de slug tronquée pour que `<base>-N` tienne dans `maxLength` ; les
 * tirets laissés en fin par la coupe sont retirés.
 */
export function truncateSlugBase(base: string, maxLength = SLUG_MAX_LENGTH): string {
  return base.slice(0, maxLength - SLUG_SUFFIX_ROOM).replace(/-+$/, '')
}

/**
 * Échappe `%`, `_` et `\` pour un motif `LIKE` PostgreSQL (caractère
 * d'échappement par défaut : `\`) : la valeur est alors comparée littéralement.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

/** Motif `LIKE` des slugs suffixés d'une base : `<base>-%`, base échappée. */
export function suffixedSlugPattern(base: string): string {
  return `${escapeLikePattern(base)}-%`
}

/**
 * Premier slug libre parmi `base`, `base-2`, `base-3`… sachant les slugs
 * déjà pris (typiquement ceux qui égalent `base` ou commencent par `base-`).
 * Calcul en mémoire : une seule lecture suffit, quel que soit le nombre de collisions.
 */
export function firstFreeSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  if (!used.has(base)) return base
  const suffix = firstFreeSuffix(used, base, 2)
  return `${base}-${suffix}`
}

/**
 * Plus petit suffixe ≥ `from` dont `<base>-<suffixe>` n'est pas pris. Au plus
 * `used.size + 1` essais : chaque échec correspond à un slug de l'ensemble.
 */
function firstFreeSuffix(used: Set<string>, base: string, from: number): number {
  const candidates = Array.from({ length: used.size + 1 }, (_, index) => from + index)
  return candidates.find((suffix) => !used.has(`${base}-${suffix}`)) ?? from + used.size + 1
}
