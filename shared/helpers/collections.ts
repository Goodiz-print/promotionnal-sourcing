/**
 * Sépare les éléments qui satisfont `keep` des autres, en conservant l'ordre :
 * `[gardés, écartés]`.
 */
export function partition<T>(items: readonly T[], keep: (item: T) => boolean): [T[], T[]] {
  return [items.filter(keep), items.filter((item) => !keep(item))]
}
