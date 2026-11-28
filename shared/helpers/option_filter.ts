/** Option d'une liste de choix (select, combobox). */
export interface ChoiceOption<T extends string = string> {
  value: T
  label: string
}

/** Minuscules sans accents : « Équateur » et « equateur » se comparent à égalité. */
export function foldForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/**
 * Options dont le libellé contient la recherche (sans tenir compte des accents ni
 * de la casse), ou dont la valeur est exactement la recherche (« DE », « fr »).
 * Une recherche vide rend toutes les options.
 */
export function filterOptions<T extends string>(
  options: readonly ChoiceOption<T>[],
  query: string
): ChoiceOption<T>[] {
  const needle = foldForSearch(query)
  if (needle === '') return [...options]
  return options.filter(
    (option) =>
      foldForSearch(option.label).includes(needle) || foldForSearch(option.value) === needle
  )
}

/**
 * Index actif après un déplacement au clavier (`delta` = +1 / -1) dans une liste
 * de `length` éléments, en bouclant aux extrémités. -1 si la liste est vide.
 */
export function moveActiveIndex(current: number, delta: number, length: number): number {
  if (length === 0) return -1
  if (current < 0) return delta > 0 ? 0 : length - 1
  return (current + delta + length) % length
}
