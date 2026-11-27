import { test } from '@japa/runner'
import {
  SLUG_MAX_LENGTH,
  escapeLikePattern,
  escapeRegExp,
  firstFreeSlug,
  numberedSlugRegex,
  suffixedSlugPattern,
  truncateSlugBase,
} from '#shared/helpers/slug'

test.group('Slug unique — utilitaires', () => {
  test('escapeLikePattern échappe %, _ et \\', ({ assert }) => {
    assert.equal(escapeLikePattern('ab_12%'), 'ab\\_12\\%')
    assert.equal(escapeLikePattern('a\\b'), 'a\\\\b')
    assert.equal(escapeLikePattern('ab-12'), 'ab-12')
  })

  test('suffixedSlugPattern : base échappée suivie de -%', ({ assert }) => {
    assert.equal(suffixedSlugPattern('ab-12'), 'ab-12-%')
    assert.equal(suffixedSlugPattern('ab_12'), 'ab\\_12-%')
  })

  test('firstFreeSlug : la base si elle est libre', ({ assert }) => {
    assert.equal(firstFreeSlug('ab-12', []), 'ab-12')
    assert.equal(firstFreeSlug('ab-12', ['ab-12-2', 'ab-12-x']), 'ab-12')
  })

  test('firstFreeSlug : premier suffixe libre à partir de 2', ({ assert }) => {
    assert.equal(firstFreeSlug('ab-12', ['ab-12']), 'ab-12-2')
    assert.equal(firstFreeSlug('ab-12', ['ab-12', 'ab-12-2', 'ab-12-3']), 'ab-12-4')
  })

  test('firstFreeSlug : comble un trou dans les suffixes', ({ assert }) => {
    assert.equal(firstFreeSlug('ab-12', ['ab-12', 'ab-12-3']), 'ab-12-2')
  })

  test('firstFreeSlug : ignore les slugs non suffixés numériquement', ({ assert }) => {
    assert.equal(firstFreeSlug('ab-12', ['ab-12', 'ab-12-extra', 'ab-12-2-bis']), 'ab-12-2')
  })

  test('base courte : inchangée', ({ assert }) => {
    assert.equal(truncateSlugBase('fixture-supplier-ab-12'), 'fixture-supplier-ab-12')
  })

  test('base trop longue : coupée pour laisser la place du suffixe', ({ assert }) => {
    const base = truncateSlugBase('a'.repeat(300))
    assert.equal(base.length, 247)
    assert.isAtMost(firstFreeSlug(base, [base, `${base}-2`]).length, SLUG_MAX_LENGTH)
    assert.isAtMost(`${base}-9999999`.length, SLUG_MAX_LENGTH)
  })

  test('coupe sur un tiret : tirets de fin retirés', ({ assert }) => {
    assert.equal(truncateSlugBase(`${'a'.repeat(9)}---bbb`, 20), 'a'.repeat(9))
  })

  test('base intacte : tiret de fin conservé (code sans caractère sluggable)', ({ assert }) => {
    assert.equal(truncateSlugBase('pf-concept-'), 'pf-concept-')
  })

  test('échappe les métacaractères d’expression régulière', ({ assert }) => {
    assert.equal(escapeRegExp('a.b_c(d)[e]\\x'), 'a\\.b_c\\(d\\)\\[e\\]\\\\x')
  })

  test('regex des suffixes numériques : voisins et points écartés', ({ assert }) => {
    const regex = new RegExp(numberedSlugRegex('pf-ab.12'))
    assert.isTrue(regex.test('pf-ab.12-2'))
    assert.isTrue(regex.test('pf-ab.12-15'))
    assert.isFalse(regex.test('pf-ab.12'))
    assert.isFalse(regex.test('pf-ab.12-extra'))
    assert.isFalse(regex.test('pf-ab.12-2-b'))
    assert.isFalse(regex.test('pf-abx12-2'))
  })
})
