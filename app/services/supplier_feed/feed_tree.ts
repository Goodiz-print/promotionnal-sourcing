/**
 * Parcours tolérant des flux JSON fournisseurs. Les flux réels (PF Concept en
 * tête) emballent leurs nœuds de façon irrégulière (`models: [{ model: [...] }]`,
 * objet seul au lieu d'une liste…) : plutôt que de coder un chemin fragile, on
 * cherche les nœuds par leurs **clés caractéristiques** (`modelCode`, `priceBar`…).
 */
import type { FeedNode } from '#shared/types/supplier_feed'

function isNode(value: unknown): value is FeedNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Le nœud porte-t-il toutes ces clés ? (comparaison insensible à la casse) */
export function hasKeys(node: FeedNode, keys: string[]): boolean {
  const lower = new Set(Object.keys(node).map((key) => key.toLowerCase()))
  return keys.every((key) => lower.has(key.toLowerCase()))
}

/** Valeur d'une clé, insensible à la casse (`itemCode` / `itemcode`). */
export function field(node: FeedNode, key: string): unknown {
  if (key in node) return node[key]
  const wanted = key.toLowerCase()
  const found = Object.keys(node).find((candidate) => candidate.toLowerCase() === wanted)
  return found === undefined ? undefined : node[found]
}

/**
 * Collecte en profondeur les nœuds qui portent `keys`, sans descendre dans un
 * nœud trouvé. S'arrête après `limit` résultats.
 */
export function collect(
  root: unknown,
  keys: string[],
  limit = Number.POSITIVE_INFINITY
): FeedNode[] {
  const found: FeedNode[] = []
  const stack: unknown[] = [root]
  while (stack.length > 0 && found.length < limit) {
    const current = stack.pop()
    if (Array.isArray(current)) {
      // Ordre du flux préservé : on empile à l'envers.
      for (let index = current.length - 1; index >= 0; index--) stack.push(current[index])
      continue
    }
    if (!isNode(current)) continue
    if (hasKeys(current, keys)) {
      found.push(current)
      continue
    }
    const values = Object.values(current)
    for (let index = values.length - 1; index >= 0; index--) stack.push(values[index])
  }
  return found
}

/** Premier nœud portant `keys`, ou `null`. */
export function first(root: unknown, keys: string[]): FeedNode | null {
  return collect(root, keys, 1)[0] ?? null
}
