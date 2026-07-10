import { test } from '@japa/runner'
import { resolveTranslation } from '#shared/helpers/translations'

test.group('i18n — resolveTranslation', () => {
  const rows = [
    { locale: 'fr', name: 'Bleu' },
    { locale: 'en', name: 'Blue' },
  ]

  test('renvoie la traduction de la locale demandée', ({ assert }) => {
    assert.equal(resolveTranslation(rows, 'en')?.name, 'Blue')
    assert.equal(resolveTranslation(rows, 'fr')?.name, 'Bleu')
  })

  test('repli sur la locale par défaut (fr) quand la locale demandée manque', ({ assert }) => {
    const onlyFr = [{ locale: 'fr', name: 'Bleu' }]
    assert.equal(resolveTranslation(onlyFr, 'en')?.name, 'Bleu')
  })

  test('repli sur la première ligne si ni la locale ni le défaut ne sont présents', ({
    assert,
  }) => {
    const onlyEn = [{ locale: 'en', name: 'Blue' }]
    assert.equal(resolveTranslation(onlyEn, 'en', 'fr')?.name, 'Blue')
  })

  test('undefined quand la collection est vide ou absente', ({ assert }) => {
    assert.isUndefined(resolveTranslation([], 'fr'))
    assert.isUndefined(resolveTranslation(undefined, 'fr'))
  })
})
