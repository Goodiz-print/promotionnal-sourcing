import { readFileSync } from 'node:fs'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import { SUPPORTED_LOCALES } from '#shared/types/i18n'
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

test.group('i18n — fichiers de langue des devis', () => {
  const flatten = (value: unknown, prefix = ''): string[] =>
    typeof value === 'object' && value !== null
      ? Object.entries(value).flatMap(([key, child]) =>
          flatten(child, prefix ? `${prefix}.${key}` : key)
        )
      : [prefix]

  test('quote.json a les mêmes clés dans les 9 langues', ({ assert }) => {
    const load = (locale: string) =>
      JSON.parse(readFileSync(app.languageFilesPath(`${locale}/quote.json`), 'utf8'))
    const reference = flatten(load('fr')).sort()

    assert.isAbove(reference.length, 50)
    for (const locale of SUPPORTED_LOCALES) {
      assert.deepEqual(flatten(load(locale)).sort(), reference, locale)
    }
  })
})
