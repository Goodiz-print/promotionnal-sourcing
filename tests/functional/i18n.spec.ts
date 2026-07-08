import { test } from '@japa/runner'

test.group('i18n — routing par préfixe de locale', () => {
  test('la racine redirige vers la locale par défaut (fr)', async ({ client }) => {
    const response = await client.get('/').redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/fr')
  })

  test("la racine suit l'en-tête Accept-Language (en)", async ({ client }) => {
    const response = await client.get('/').header('Accept-Language', 'en').redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/en')
  })

  test('une locale non supportée renvoie 404', async ({ client }) => {
    const response = await client.get('/de').redirects(0)

    response.assertStatus(404)
  })
})

test.group('i18n — détection de la locale', () => {
  test('/fr expose le français', async ({ client, assert }) => {
    const response = await client.get('/fr').withInertia()

    response.assertStatus(200)
    response.assertInertiaPropsContains({ locale: 'fr' })
    assert.include(response.inertiaProps.translations['home.title'], 'Ça fonctionne')
  })

  test('/en expose l’anglais', async ({ client, assert }) => {
    const response = await client.get('/en').withInertia()

    response.assertStatus(200)
    response.assertInertiaPropsContains({ locale: 'en' })
    assert.include(response.inertiaProps.translations['home.title'], 'It works')
  })

  test('expose la liste des locales supportées', async ({ client }) => {
    const response = await client.get('/fr').withInertia()

    response.assertStatus(200)
    response.assertInertiaPropsContains({ supportedLocales: ['fr', 'en'] })
  })
})

test.group('i18n — changement de langue', () => {
  test('POST /locale pose le cookie et redirige vers l’URL préfixée', async ({
    client,
    assert,
  }) => {
    const response = await client
      .post('/locale')
      .header('referer', '/fr/login')
      .withCsrfToken()
      .form({ locale: 'en' })
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/en/login')
    assert.property(response.cookies(), 'locale')
  })

  test('POST /locale rejette une locale non supportée (message traduit)', async ({ client }) => {
    const response = await client
      .post('/locale')
      .withCsrfToken()
      .header('Accept-Language', 'en')
      .accept('json')
      .form({ locale: 'de' })

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [{ message: 'The selected language is invalid' }],
    })
  })
})
