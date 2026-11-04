import { test } from '@japa/runner'
import { compareSiblingCategories, orderCategoriesAsTree } from '#shared/helpers/category_tree'

const node = (id: number, parentId: number | null, position: number, slug: string) => ({
  id,
  parentId,
  position,
  slug,
})

test.group('Ordre d’arbre des catégories', () => {
  test('parents avant enfants, sœurs triées par position puis slug', ({ assert }) => {
    const result = orderCategoriesAsTree([
      node(1, null, 1, 'b'),
      node(2, null, 0, 'z'),
      node(3, 2, 0, 'enfant'),
      node(4, null, 1, 'a'),
    ])

    assert.deepEqual(
      result.map((entry) => entry.category.id),
      [2, 3, 4, 1]
    )
    assert.deepEqual(
      result.map((entry) => entry.depth),
      [0, 1, 0, 0]
    )
  })

  test('indique la présence d’une sœur avant et après', ({ assert }) => {
    const result = orderCategoriesAsTree([node(1, null, 0, 'a'), node(2, null, 1, 'b')])

    assert.isFalse(result[0].hasPreviousSibling)
    assert.isTrue(result[0].hasNextSibling)
    assert.isTrue(result[1].hasPreviousSibling)
    assert.isFalse(result[1].hasNextSibling)
  })

  test('un enfant dont le parent est absent de la liste est traité comme une racine', ({
    assert,
  }) => {
    const result = orderCategoriesAsTree([node(5, 99, 0, 'orpheline'), node(6, null, 1, 'racine')])

    assert.deepEqual(
      result.map((entry) => [entry.category.id, entry.depth]),
      [
        [5, 0],
        [6, 0],
      ]
    )
  })

  test('un cycle ne duplique ni ne boucle', ({ assert }) => {
    const result = orderCategoriesAsTree([node(1, 2, 0, 'a'), node(2, 1, 0, 'b')])

    assert.isAtMost(result.length, 2)
    assert.equal(new Set(result.map((entry) => entry.category.id)).size, result.length)
  })

  test('à position égale, le slug départage (binaire), puis l’identifiant', ({ assert }) => {
    assert.isBelow(compareSiblingCategories(node(1, null, 0, 'a'), node(2, null, 0, 'b')), 0)
    assert.isBelow(compareSiblingCategories(node(1, null, 0, 'B'), node(2, null, 0, 'a')), 0)
    assert.isBelow(compareSiblingCategories(node(1, null, 0, 'x'), node(2, null, 0, 'x')), 0)
    assert.isBelow(compareSiblingCategories(node(9, null, 0, 'z'), node(1, null, 1, 'a')), 0)
  })
})
