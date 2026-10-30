import { readdirSync, readFileSync } from 'node:fs'
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

  test("repli sur l'anglais quand la locale demandée et la source manquent", ({ assert }) => {
    assert.equal(resolveTranslation(rows, 'de')?.name, 'Blue')
  })

  test('repli sur la locale par défaut (fr) quand ni la locale ni la source ni en ne sont là', ({
    assert,
  }) => {
    const frAndBg = [
      { locale: 'bg', name: 'Син' },
      { locale: 'fr', name: 'Bleu' },
    ]
    assert.equal(resolveTranslation(frAndBg, 'de')?.name, 'Bleu')
  })

  test("repli sur la langue source avant l'anglais", ({ assert }) => {
    const withSource = [
      { locale: 'en', name: 'Blue' },
      { locale: 'bg', name: 'Син' },
    ]
    assert.equal(resolveTranslation(withSource, 'de', { sourceLocale: 'bg' })?.name, 'Син')
  })

  test('une langue de contenu hors fr/en est servie telle quelle', ({ assert }) => {
    const withBg = [
      { locale: 'en', name: 'Blue' },
      { locale: 'bg', name: 'Син' },
    ]
    assert.equal(resolveTranslation(withBg, 'bg')?.name, 'Син')
  })

  test('repli final déterministe : première locale par ordre alphabétique', ({ assert }) => {
    const onlyOthers = [
      { locale: 'sv', name: 'Blå' },
      { locale: 'de', name: 'Blau' },
    ]
    assert.equal(resolveTranslation(onlyOthers, 'it')?.name, 'Blau')
    assert.equal(resolveTranslation([...onlyOthers].reverse(), 'it')?.name, 'Blau')
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

  test('chaque fichier de langue a les mêmes clés dans les 9 langues', ({ assert }) => {
    const load = (locale: string, file: string) =>
      JSON.parse(readFileSync(app.languageFilesPath(`${locale}/${file}`), 'utf8'))
    const files = readdirSync(app.languageFilesPath('fr')).filter((file) => file.endsWith('.json'))

    assert.isAbove(files.length, 20)
    for (const file of files) {
      const reference = flatten(load('fr', file)).sort()
      for (const locale of SUPPORTED_LOCALES) {
        assert.deepEqual(flatten(load(locale, file)).sort(), reference, `${locale}/${file}`)
      }
    }
  })
})
