import { test } from '@japa/runner'
import { TEST_PASSWORD } from '#database/factories/user_factory'
import { createOrganizationWithOwner } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'

/** Page protégée, avec une query string : elle doit survivre à la connexion. */
const PROTECTED_PATH = '/fr/account?tab=security'

function loginWithRedirect(path: string, locale = 'fr'): string {
  return `/${locale}/login?redirect=${encodeURIComponent(path)}`
}

/**
 * `AuthMiddleware` sans session (#225) : la page de connexion est localisée et
 * ramène, après la connexion, à la page demandée — y compris depuis un lien
 * reçu par mail. Un appel JSON garde son 401.
 */
test.group('Connexion requise — retour à la page demandée', (group) => {
  useDatabase(group)

  test('une page HTML renvoie vers la connexion, query string comprise une seule fois', async ({
    client,
  }) => {
    const response = await client.get(PROTECTED_PATH).header('accept', 'text/html').redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', loginWithRedirect(PROTECTED_PATH))
  })

  test('une visite Inertia est reprise de la même façon', async ({ client }) => {
    const response = await client.get(PROTECTED_PATH).withInertia().redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', loginWithRedirect(PROTECTED_PATH))
  })

  test('la page de connexion est dans la langue de la page demandée', async ({ client }) => {
    const response = await client.get('/en/account').header('accept', 'text/html').redirects(0)

    response.assertHeader('location', loginWithRedirect('/en/account', 'en'))
  })

  test('un appel qui attend du JSON reçoit un 401, sans redirection', async ({
    client,
    assert,
  }) => {
    const response = await client
      .get(PROTECTED_PATH)
      .header('accept', 'application/json')
      .redirects(0)

    response.assertStatus(401)
    assert.isUndefined(response.header('location'))
  })

  test('un appel qui n’accepte ni HTML ni JSON mène à la connexion, sans redirect', async ({
    client,
  }) => {
    const response = await client.get(PROTECTED_PATH).header('accept', 'text/plain').redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/fr/login')
  })

  test('un POST sans session mène à la connexion, sans redirect', async ({ client }) => {
    const response = await client
      .post('/fr/rfqs')
      .header('accept', 'text/html')
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/fr/login')
  })

  test('un formulaire envoyé sans session ne laisse aucun mot de passe en session', async ({
    client,
    assert,
  }) => {
    const response = await client
      .post('/fr/rfqs')
      .header('accept', 'text/html')
      .withCsrfToken()
      .form({ email: 'agence@example.com', password: 'secret', password_confirmation: 'secret' })
      .redirects(0)

    response.assertStatus(302)
    const flashed = response.flashMessages()
    assert.equal(flashed.email, 'agence@example.com')
    assert.isUndefined(flashed.password)
    assert.isUndefined(flashed.password_confirmation)
    assert.isDefined(flashed.error)
  })

  test('une fois connecté, l’utilisateur revient à la page demandée', async ({ client }) => {
    const { owner } = await createOrganizationWithOwner()
    const refused = await client.get(PROTECTED_PATH).header('accept', 'text/html').redirects(0)
    refused.assertHeader('location', loginWithRedirect(PROTECTED_PATH))

    const login = await client
      .post(loginWithRedirect(PROTECTED_PATH))
      .withCsrfToken()
      .form({ email: owner.email, password: TEST_PASSWORD })
      .redirects(0)

    login.assertStatus(302)
    login.assertHeader('location', PROTECTED_PATH)
  })
})
