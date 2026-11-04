/**
 * Ordre d'arbre des catégories (#165). `position` classe une catégorie parmi ses
 * sœurs seulement : pour une liste plate, il faut donc parcourir l'arbre
 * (parents avant enfants, sœurs triées par `position` puis `slug`).
 */
export interface CategoryTreeNode {
  id: number
  parentId: number | null
  position: number
  slug: string
}

export interface CategoryTreeEntry<T extends CategoryTreeNode> {
  category: T
  depth: number
  hasPreviousSibling: boolean
  hasNextSibling: boolean
}

/**
 * Parcours en profondeur. Une catégorie dont le parent est absent de la liste
 * (ex. parent sans produit actif) est traitée comme une racine, pour ne jamais
 * disparaître. Chaque catégorie apparaît une seule fois, même si les données
 * contenaient un cycle.
 */
export function orderCategoriesAsTree<T extends CategoryTreeNode>(
  categories: T[]
): CategoryTreeEntry<T>[] {
  const ids = new Set(categories.map((category) => category.id))
  const byParent = new Map<number | null, T[]>()
  for (const category of categories) {
    const parentKey =
      category.parentId !== null && ids.has(category.parentId) ? category.parentId : null
    const siblings = byParent.get(parentKey) ?? []
    siblings.push(category)
    byParent.set(parentKey, siblings)
  }
  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => a.position - b.position || a.slug.localeCompare(b.slug))
  }

  const ordered: CategoryTreeEntry<T>[] = []
  const visited = new Set<number>()
  const walk = (parentId: number | null, depth: number) => {
    const siblings = byParent.get(parentId) ?? []
    siblings.forEach((category, index) => {
      if (visited.has(category.id)) return
      visited.add(category.id)
      ordered.push({
        category,
        depth,
        hasPreviousSibling: index > 0,
        hasNextSibling: index < siblings.length - 1,
      })
      walk(category.id, depth + 1)
    })
  }
  walk(null, 0)
  return ordered
}
