import { test } from '@japa/runner'
import { pageTitle } from '#shared/helpers/page_title'

test.group('pageTitle', () => {
  test('suffixe le titre par le nom de l’application', ({ assert }) => {
    assert.equal(pageTitle('Catalogue', 'App'), 'Catalogue - App')
  })

  test('nom de l’application seul sans titre', ({ assert }) => {
    assert.equal(pageTitle('', 'App'), 'App')
  })

  test('titre qui porte déjà la marque laissé tel quel', ({ assert }) => {
    assert.equal(
      pageTitle('Promotional Sourcing — Accueil', 'App'),
      'Promotional Sourcing — Accueil'
    )
  })
})
