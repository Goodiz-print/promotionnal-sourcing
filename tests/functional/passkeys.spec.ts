import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import { DateTime } from 'luxon'
import { PasskeyFactory } from '#database/factories/passkey_factory'
import { UserFactory } from '#database/factories/user_factory'
import Passkey from '#models/passkey'
import { FakeAuthenticator } from '#tests/utils/fake_authenticator'
import { useDatabase } from '#tests/utils/setup'
import type User from '#models/user'

const REGISTRATION = 'passkey.registration'
const AUTHENTICATION = 'passkey.authentication'

/** Défi tel que `PasskeyService` le range en session. */
const challengeIn = (value: string, expiresAt = Date.now() + 60_000) => ({ value, expiresAt })

async function enroll(user: User, authenticator = new FakeAuthenticator(), counter = 0) {
  const passkey = await PasskeyFactory.merge({
    userId: user.id,
    credentialId: authenticator.credentialId,
    publicKey: authenticator.publicKey,
    counter,
  }).create()
  return { passkey, authenticator }
}

test.group('Passkeys — enregistrement', (group) => {
  useDatabase(group, { seed: 'none' })

  test('les options exigent une connexion', async ({ client }) => {
    const response = await client.get('/fr/account/passkeys/options').redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/login')
  })

  test('les options émettent un défi conservé en session et excluent les passkeys existantes', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    const { authenticator } = await enroll(user)

    const response = await client.get('/fr/account/passkeys/options').loginAs(user)

    response.assertStatus(200)
    const options = response.body()
    assert.equal(options.rp.id, 'localhost')
    assert.equal(response.session(REGISTRATION).value, options.challenge)
    assert.deepEqual(
      options.excludeCredentials.map((c: { id: string }) => c.id),
      [authenticator.credentialId]
    )
  })

  test('enregistre une passkey valide et consomme le défi', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const authenticator = new FakeAuthenticator()

    const response = await client
      .post('/fr/account/passkeys')
      .loginAs(user)
      .withSession({ [REGISTRATION]: challengeIn('challenge-1') })
      .redirects(0)
      .withCsrfToken()
      .form({
        name: 'MacBook',
        credential: JSON.stringify(authenticator.register({ challenge: 'challenge-1' })),
      })

    response.assertStatus(302)
    assert.isUndefined(response.session(REGISTRATION))
    const passkey = await Passkey.query().where('userId', user.id).firstOrFail()
    assert.equal(passkey.name, 'MacBook')
    assert.equal(passkey.credentialId, authenticator.credentialId)
    assert.equal(passkey.publicKey, authenticator.publicKey)
    assert.equal(Number(passkey.counter), 0)
    assert.isNull(passkey.lastUsedAt)
  })

  test('refuse une réponse sans défi en session', async ({ client, assert }) => {
    const user = await UserFactory.create()

    const response = await client
      .post('/fr/account/passkeys')
      .loginAs(user)
      .redirects(0)
      .withCsrfToken()
      .form({
        name: 'MacBook',
        credential: JSON.stringify(new FakeAuthenticator().register({ challenge: 'x' })),
      })

    response.assertStatus(302)
    assert.equal(
      await Passkey.query()
        .where('userId', user.id)
        .count('* as n')
        .first()
        .then((r) => Number(r?.$extras.n)),
      0
    )
  })

  test('refuse un défi périmé, un autre défi ou une autre origine', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const authenticator = new FakeAuthenticator()
    const attempts = [
      {
        session: challengeIn('c', Date.now() - 1),
        response: authenticator.register({ challenge: 'c' }),
      },
      { session: challengeIn('c'), response: authenticator.register({ challenge: 'autre' }) },
      {
        session: challengeIn('c'),
        response: authenticator.register({ challenge: 'c', origin: 'https://evil.example' }),
      },
    ]

    for (const attempt of attempts) {
      const response = await client
        .post('/fr/account/passkeys')
        .loginAs(user)
        .withSession({ [REGISTRATION]: attempt.session })
        .redirects(0)
        .withCsrfToken()
        .form({ name: 'MacBook', credential: JSON.stringify(attempt.response) })

      response.assertStatus(302)
    }
    const rows = await Passkey.query().where('userId', user.id)
    assert.lengthOf(rows, 0)
  })

  test('refuse une passkey déjà enregistrée, même par un autre compte', async ({
    client,
    assert,
  }) => {
    const owner = await UserFactory.create()
    const other = await UserFactory.create()
    const { authenticator } = await enroll(owner)

    const response = await client
      .post('/fr/account/passkeys')
      .loginAs(other)
      .withSession({ [REGISTRATION]: challengeIn('c') })
      .redirects(0)
      .withCsrfToken()
      .form({
        name: 'Copie',
        credential: JSON.stringify(authenticator.register({ challenge: 'c' })),
      })

    response.assertStatus(302)
    assert.lengthOf(await Passkey.query().where('userId', other.id), 0)
  })

  test('refuse un nom vide', async ({ client, assert }) => {
    const user = await UserFactory.create()

    const response = await client
      .post('/fr/account/passkeys')
      .loginAs(user)
      .withSession({ [REGISTRATION]: challengeIn('c') })
      .redirects(0)
      .withCsrfToken()
      .form({
        name: '   ',
        credential: JSON.stringify(new FakeAuthenticator().register({ challenge: 'c' })),
      })

    response.assertStatus(302)
    assert.lengthOf(await Passkey.query().where('userId', user.id), 0)
  })
})

test.group('Passkeys — gestion depuis « mon compte »', (group) => {
  useDatabase(group, { seed: 'none' })

  test('la page liste les passkeys sans exposer clé publique ni identifiant', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    const { passkey } = await enroll(user)
    await enroll(await UserFactory.create())

    const response = await client.get('/fr/account').loginAs(user).withInertia()

    response.assertInertiaComponent('account/show')
    const passkeys = response.inertiaProps.passkeys as Record<string, unknown>[]
    assert.lengthOf(passkeys, 1)
    assert.equal(passkeys[0].id, passkey.id)
    assert.notProperty(passkeys[0], 'publicKey')
    assert.notProperty(passkeys[0], 'credentialId')
  })

  test('renomme sa passkey', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const { passkey } = await enroll(user)

    const response = await client
      .patch(`/fr/account/passkeys/${passkey.id}`)
      .loginAs(user)
      .redirects(0)
      .withCsrfToken()
      .form({ name: 'Clé USB' })

    response.assertStatus(302)
    await passkey.refresh()
    assert.equal(passkey.name, 'Clé USB')
  })

  test('supprime sa passkey', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const { passkey } = await enroll(user)

    const response = await client
      .delete(`/fr/account/passkeys/${passkey.id}`)
      .loginAs(user)
      .redirects(0)
      .withCsrfToken()

    response.assertStatus(302)
    assert.isNull(await Passkey.find(passkey.id))
  })

  test("ne touche pas à la passkey d'un autre compte", async ({ client, assert }) => {
    const user = await UserFactory.create()
    const { passkey } = await enroll(await UserFactory.create())

    const rename = await client
      .patch(`/fr/account/passkeys/${passkey.id}`)
      .loginAs(user)
      .redirects(0)
      .withCsrfToken()
      .form({ name: 'Piratée' })
    const remove = await client
      .delete(`/fr/account/passkeys/${passkey.id}`)
      .loginAs(user)
      .redirects(0)
      .withCsrfToken()

    rename.assertStatus(404)
    remove.assertStatus(404)
    await passkey.refresh()
    assert.notEqual(passkey.name, 'Piratée')
  })

  test('la suppression du compte efface aussi les passkeys', async ({ client, assert }) => {
    const user = await UserFactory.create()
    await enroll(user)

    const response = await client
      .delete('/fr/account')
      .loginAs(user)
      .redirects(0)
      .withCsrfToken()
      .form({ currentPassword: 'password123' })

    response.assertStatus(302)
    assert.lengthOf(await Passkey.query().where('userId', user.id), 0)
  })
})

test.group('Passkeys — connexion', (group) => {
  useDatabase(group, { seed: 'none' })

  /** Poste une assertion signée avec le défi en session. */
  function login(
    client: ApiClient,
    credential: unknown,
    options: { challenge?: string; query?: string } = {}
  ) {
    const challenge = options.challenge ?? 'login-challenge'
    return client
      .post(`/fr/passkeys/login${options.query ?? ''}`)
      .withSession({ [AUTHENTICATION]: challengeIn(challenge) })
      .redirects(0)
      .withCsrfToken()
      .form({ credential: JSON.stringify(credential) })
  }

  test('les options émettent un défi sans liste de passkeys (identifiants découvrables)', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/fr/passkeys/options')

    response.assertStatus(200)
    assert.deepEqual(response.body().allowCredentials, [])
    assert.equal(response.session(AUTHENTICATION).value, response.body().challenge)
  })

  test('les options sont refusées à un utilisateur déjà connecté', async ({ client }) => {
    const user = await UserFactory.create()

    const response = await client.get('/fr/passkeys/options').loginAs(user).redirects(0)

    response.assertStatus(302)
  })

  test('connecte le propriétaire de la passkey et met à jour compteur et dernière utilisation', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    const { passkey, authenticator } = await enroll(user)

    const response = await login(
      client,
      authenticator.authenticate({ challenge: 'login-challenge', counter: 5 })
    )

    response.assertStatus(302)
    response.assertHeader('location', '/fr/onboarding')
    assert.equal(response.session('auth_web'), user.id)
    assert.isUndefined(response.session(AUTHENTICATION))
    await passkey.refresh()
    assert.equal(Number(passkey.counter), 5)
    assert.isTrue(
      passkey.lastUsedAt !== null && passkey.lastUsedAt > DateTime.now().minus({ minutes: 1 })
    )
  })

  test('respecte un redirect interne sûr et ignore un redirect externe', async ({ client }) => {
    const user = await UserFactory.create()
    const { authenticator } = await enroll(user)

    const safe = await login(
      client,
      authenticator.authenticate({ challenge: 'login-challenge', counter: 1 }),
      {
        query: '?redirect=/fr/suppliers',
      }
    )
    const unsafe = await login(
      client,
      authenticator.authenticate({ challenge: 'login-challenge', counter: 2 }),
      {
        query: '?redirect=https://evil.example',
      }
    )

    safe.assertHeader('location', '/fr/suppliers')
    unsafe.assertHeader('location', '/fr/onboarding')
  })

  test('refuse une passkey inconnue', async ({ client, assert }) => {
    const response = await login(
      client,
      new FakeAuthenticator().authenticate({ challenge: 'login-challenge' })
    )

    response.assertStatus(302)
    assert.isUndefined(response.session('auth_web'))
  })

  test("refuse une signature d'un autre authentificateur", async ({ client, assert }) => {
    const user = await UserFactory.create()
    const { authenticator } = await enroll(user)
    const impostor = new FakeAuthenticator()
    const forged = {
      ...impostor.authenticate({ challenge: 'login-challenge' }),
      id: authenticator.credentialId,
      rawId: authenticator.credentialId,
    }

    const response = await login(client, forged)

    assert.isUndefined(response.session('auth_web'))
  })

  test('refuse un défi périmé, absent ou rejoué', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const { authenticator } = await enroll(user)
    const credential = authenticator.authenticate({ challenge: 'login-challenge', counter: 1 })

    const expired = await client
      .post('/fr/passkeys/login')
      .withSession({ [AUTHENTICATION]: challengeIn('login-challenge', Date.now() - 1) })
      .redirects(0)
      .withCsrfToken()
      .form({ credential: JSON.stringify(credential) })
    const missing = await client
      .post('/fr/passkeys/login')
      .redirects(0)
      .withCsrfToken()
      .form({ credential: JSON.stringify(credential) })
    const wrongChallenge = await login(client, credential, { challenge: 'autre-defi' })

    for (const response of [expired, missing, wrongChallenge]) {
      assert.isUndefined(response.session('auth_web'))
    }
  })

  test('refuse un compteur qui ne progresse pas (authentificateur cloné)', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    const { authenticator } = await enroll(user, new FakeAuthenticator(), 10)

    const response = await login(
      client,
      authenticator.authenticate({ challenge: 'login-challenge', counter: 3 })
    )

    assert.isUndefined(response.session('auth_web'))
  })

  test('refuse le JSON invalide', async ({ client, assert }) => {
    const response = await client
      .post('/fr/passkeys/login')
      .withSession({ [AUTHENTICATION]: challengeIn('c') })
      .redirects(0)
      .withCsrfToken()
      .form({ credential: 'pas du json' })

    response.assertStatus(302)
    assert.isUndefined(response.session('auth_web'))
  })
})
