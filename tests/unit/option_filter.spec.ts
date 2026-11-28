import { test } from '@japa/runner'
import { filterOptions, foldForSearch, moveActiveIndex } from '#shared/helpers/option_filter'

const countries = [
  { value: 'DE', label: 'Allemagne' },
  { value: 'EC', label: 'Équateur' },
  { value: 'FR', label: 'France' },
  { value: 'IE', label: 'Irlande' },
]

test.group('foldForSearch', () => {
  test('retire accents, casse et espaces autour', ({ assert }) => {
    assert.equal(foldForSearch('  Équateur '), 'equateur')
    assert.equal(foldForSearch('São Tomé'), 'sao tome')
  })
})

test.group('filterOptions', () => {
  test('rend toutes les options pour une recherche vide', ({ assert }) => {
    assert.deepEqual(filterOptions(countries, '  '), countries)
  })

  test('cherche dans le libellé sans tenir compte des accents ni de la casse', ({ assert }) => {
    assert.deepEqual(
      filterOptions(countries, 'equa').map((option) => option.value),
      ['EC']
    )
    assert.deepEqual(
      filterOptions(countries, 'LAN').map((option) => option.value),
      ['IE']
    )
  })

  test('trouve une option par son code exact', ({ assert }) => {
    assert.deepEqual(
      filterOptions(countries, 'ec').map((option) => option.value),
      ['EC']
    )
  })

  test('cumule les correspondances de libellé et de code', ({ assert }) => {
    assert.deepEqual(
      filterOptions(countries, 'de').map((option) => option.value),
      ['DE', 'IE']
    )
  })

  test('rend une liste vide quand rien ne correspond', ({ assert }) => {
    assert.deepEqual(filterOptions(countries, 'zzz'), [])
  })

  test('ne modifie pas la liste reçue', ({ assert }) => {
    const result = filterOptions(countries, '')
    result.pop()
    assert.lengthOf(countries, 4)
  })
})

test.group('moveActiveIndex', () => {
  test('avance et recule en bouclant', ({ assert }) => {
    assert.equal(moveActiveIndex(0, 1, 3), 1)
    assert.equal(moveActiveIndex(2, 1, 3), 0)
    assert.equal(moveActiveIndex(0, -1, 3), 2)
  })

  test('part du début ou de la fin sans index actif', ({ assert }) => {
    assert.equal(moveActiveIndex(-1, 1, 3), 0)
    assert.equal(moveActiveIndex(-1, -1, 3), 2)
  })

  test('rend -1 pour une liste vide', ({ assert }) => {
    assert.equal(moveActiveIndex(0, 1, 0), -1)
  })
})
