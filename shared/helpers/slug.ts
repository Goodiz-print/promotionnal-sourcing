/**
 * Utilitaires purs de calcul de slug unique.
 */

/** Longueur de la colonne `products.slug`. */
export const SLUG_MAX_LENGTH = 255

/** Place réservée au suffixe `-N` d'un slug (jusqu'à 7 chiffres). */
export const SLUG_SUFFIX_ROOM = 8

/**
 * Base de slug tronquée pour que `<base>-N` tienne dans `maxLength`. Les
 * tirets de fin ne sont retirés que s'ils viennent de la coupe : une base
 * intacte (`pf-concept-` pour un code sans caractère sluggable) est conservée,
 * pour ne pas retomber sur le slug nu du fournisseur et sa famille `-N`.
 */
export function truncateSlugBase(base: string, maxLength = SLUG_MAX_LENGTH): string {
  const limit = maxLength - SLUG_SUFFIX_ROOM
  if (base.length <= limit) return base
  return base.slice(0, limit).replace(/-+$/, '')
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

/** Échappe les métacaractères d'une expression régulière (JS ou PostgreSQL). */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, (char) => `\\${char}`)
}

/**
 * Expression régulière (opérateur PostgreSQL `~`) des seuls slugs suffixés
 * numériquement d'une base : `^<base>-[0-9]+$`. Écarte les codes voisins
 * (`<base>-extra`, `<base>-12-b`) que le motif `LIKE` laisse passer.
 */
export function numberedSlugRegex(base: string): string {
  return `^${escapeRegExp(base)}-[0-9]+$`
}

/**
 * Premier slug libre parmi `base`, `base-2`, `base-3`… sachant les slugs
 * déjà pris (typiquement ceux qui égalent `base` ou commencent par `base-`).
 * Calcul en mémoire : une seule lecture suffit, quel que soit le nombre de collisions.
 */
export function firstFreeSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  if (!used.has(base)) return base
  // Au plus `used.size + 1` essais : chaque échec correspond à un slug pris.
  const suffixes = Array.from({ length: used.size + 1 }, (_, index) => index + 2)
  const free = suffixes.find((suffix) => !used.has(`${base}-${suffix}`)) ?? used.size + 2
  return `${base}-${free}`
}
