import { test } from '@japa/runner'
import { UserFactory } from '#database/factories/user_factory'
import { useDatabase } from '#tests/utils/setup'
import { contentLocaleFor, SUPPORTED_LOCALES } from '#shared/types/i18n'

const NEW_LOCALES = ['de', 'es', 'it', 'nl', 'pt', 'pl', 'sv'] as const

test.group('Langues européennes — interface', (group) => {
  useDatabase(group, { seed: 'none' })

  for (const locale of NEW_LOCALES) {
    test(`/${locale} et /${locale}/contact répondent 200 dans la langue`, async ({
      client,
      assert,
    }) => {
      const home = await client.get(`/${locale}`).withInertia()
      home.assertStatus(200)
      home.assertInertiaPropsContains({ locale })
      assert.exists(home.inertiaProps.translations['landing.hero.titleWord1'])
      assert.notEqual(
        home.inertiaProps.translations['landing.hero.titleWord1'],
        'Simplifié.',
        'le hero doit être traduit'
      )

      const contact = await client.get(`/${locale}/contact`).withInertia()
      contact.assertStatus(200)
    })

    test(`/${locale}/privacy retombe sur les textes juridiques anglais`, async ({
      client,
      assert,
    }) => {
      const response = await client.get(`/${locale}/privacy`).withInertia()

      response.assertStatus(200)
      assert.equal(
        response.inertiaProps.translations['privacy.heading'],
        'Privacy policy',
        'les domaines juridiques non traduits reprennent l’anglais'
      )
      assert.exists(response.inertiaProps.translations['legal.sections.editeur.title'])
    })
  }

  test("le sitemap référence chaque langue d'interface", async ({ client, assert }) => {
    const response = await client.get('/sitemap.xml')

    for (const locale of SUPPORTED_LOCALES) {
      assert.include(response.text(), `/${locale}/contact</loc>`)
    }
  })

  test('une locale hors liste renvoie toujours 404', async ({ client }) => {
    const response = await client.get('/ru/contact').redirects(0)

    response.assertStatus(404)
  })

  test('le changement de langue conserve la page dans la nouvelle langue', async ({ client }) => {
    const response = await client
      .post('/locale')
      .redirects(0)
      .withCsrfToken()
      .header('referer', 'http://localhost/fr/contact')
      .json({ locale: 'de' })

    response.assertStatus(302)
    response.assertHeader('location', '/de/contact')
  })

  test("un utilisateur peut choisir une nouvelle langue d'interface", async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    const response = await client
      .post('/locale')
      .redirects(0)
      .withCsrfToken()
      .loginAs(user)
      .json({ locale: 'sv' })

    response.assertStatus(302)
    await user.refresh()
    assert.equal(user.locale, 'sv')
  })
})

test.group('Langues européennes — contenu du catalogue', () => {
  test("seules le français et l'anglais ont du contenu, les autres lisent l'anglais", ({
    assert,
  }) => {
    assert.equal(contentLocaleFor('fr'), 'fr')
    assert.equal(contentLocaleFor('en'), 'en')
    for (const locale of NEW_LOCALES) {
      assert.equal(contentLocaleFor(locale), 'en')
    }
  })
})
