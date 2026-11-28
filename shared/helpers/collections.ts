/**
 * Sépare les éléments qui satisfont `keep` des autres, en conservant l'ordre :
 * `[gardés, écartés]`.
 */
export function partition<T>(items: readonly T[], keep: (item: T) => boolean): [T[], T[]] {
  return [items.filter(keep), items.filter((item) => !keep(item))]
}

/**
 * Paramètre de requête répété (`?a=1&a=2`) ou unique (`?a=1`) ramené à une
 * liste ; absent → liste vide.
 */
export function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (value === undefined) return []
  return [value]
}

/**
 * Comparateur de tri par code UTF-16 (ordre de `<` / `>`, indépendant de la
 * locale) : `-1`, `0` ou `1`. Sert aux sérialisations stables (clés d'idempotence).
 */
export function compareCodeUnits(a: string, b: string): number {
  return Number(a > b) - Number(a < b)
}
