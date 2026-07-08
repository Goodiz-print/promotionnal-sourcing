import { test } from '@japa/runner'

test.group('i18n — détection de la locale', () => {
  test('utilise le français par défaut (aucun en-tête)', async ({ client, assert }) => {
    const response = await client.get('/').withInertia()

    response.assertStatus(200)
    response.assertInertiaPropsContains({ locale: 'fr' })
    assert.include(response.inertiaProps.translations['home.title'], 'Ça fonctionne')
  })

  test("respecte l'en-tête Accept-Language", async ({ client, assert }) => {
    const response = await client.get('/').header('Accept-Language', 'en').withInertia()

    response.assertStatus(200)
    response.assertInertiaPropsContains({ locale: 'en' })
    assert.include(response.inertiaProps.translations['home.title'], 'It works')
  })

  test('expose la liste des locales supportées', async ({ client }) => {
    const response = await client.get('/').withInertia()

    response.assertStatus(200)
    response.assertInertiaPropsContains({ supportedLocales: ['fr', 'en'] })
  })
})

test.group('i18n — changement de langue', () => {
  test('POST /locale pose le cookie et redirige', async ({ client, assert }) => {
    const response = await client
      .post('/locale')
      .header('referer', '/')
      .withCsrfToken()
      .form({ locale: 'en' })
      .redirects(0)

    response.assertStatus(302)
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
