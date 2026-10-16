import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import mail from '@adonisjs/mail/services/main'
import { UserFactory, TEST_PASSWORD } from '#database/factories/user_factory'
import PasswordResetNotification from '#mails/password_reset_notification'
import User from '#models/user'
import { useDatabase } from '#tests/utils/setup'

test.group('Mot de passe oublié', (group) => {
  useDatabase(group, { seed: 'none' })

  let fakeMailer: ReturnType<typeof mail.fake>
  group.each.setup(() => {
    fakeMailer = mail.fake()
    return () => mail.restore()
  })

  /** Chemin + querystring du lien contenu dans le dernier mail envoyé. */
  function sentResetPath(): string {
    const sent = fakeMailer.mails.sent((m) => m instanceof PasswordResetNotification)
    const { resetUrl } = sent[sent.length - 1] as unknown as { resetUrl: string }
    const url = new URL(resetUrl, 'http://localhost')
    return `${url.pathname}${url.search}`
  }

  async function canLogin(email: string, password: string) {
    return User.verifyCredentials(email, password).then(
      () => true,
      () => false
    )
  }

  async function requestLink(client: ApiClient, email: string) {
    await client.post('/fr/password/forgot').redirects(0).withCsrfToken().json({ email })
    return sentResetPath()
  }

  test('la page de demande est accessible aux invités', async ({ client }) => {
    const response = await client.get('/fr/password/forgot').withInertia()
    response.assertStatus(200)
    response.assertInertiaComponent('auth/forgot_password')
  })

  test('un compte existant reçoit un mail avec un lien signé', async ({ client, assert }) => {
    await UserFactory.merge({ email: 'membre@example.com' }).create()

    const response = await client
      .post('/fr/password/forgot')
      .redirects(0)
      .withCsrfToken()
      .json({ email: 'MEMBRE@example.com' })

    response.assertStatus(302)
    fakeMailer.mails.assertSentCount(PasswordResetNotification, 1)
    assert.match(sentResetPath(), /^\/fr\/password\/reset\/\d+\?.*signature=/)
  })

  test('un email inconnu reçoit la même réponse et aucun mail', async ({ client }) => {
    const response = await client
      .post('/fr/password/forgot')
      .redirects(0)
      .withCsrfToken()
      .json({ email: 'inconnu@example.com' })

    response.assertStatus(302)
    fakeMailer.mails.assertNoneSent()
  })

  test('le lien permet de choisir un nouveau mot de passe, puis le login fonctionne', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.merge({ email: 'membre@example.com' }).create()
    const path = await requestLink(client, 'membre@example.com')

    const page = await client.get(path).withInertia()
    page.assertStatus(200)
    page.assertInertiaComponent('auth/reset_password')

    const reset = await client
      .post(path)
      .redirects(0)
      .withCsrfToken()
      .json({ password: 'nouveau-mdp-1', passwordConfirmation: 'nouveau-mdp-1' })
    reset.assertStatus(302)
    reset.assertHeader('location', '/fr/login')

    assert.isTrue(await canLogin(user.email, 'nouveau-mdp-1'))
    assert.isFalse(await canLogin(user.email, TEST_PASSWORD))

    const login = await client
      .post('/fr/login')
      .redirects(0)
      .withCsrfToken()
      .json({ email: 'membre@example.com', password: 'nouveau-mdp-1' })
    login.assertStatus(302)
  })

  test('le lien est à usage unique', async ({ client, assert }) => {
    await UserFactory.merge({ email: 'membre@example.com' }).create()
    const path = await requestLink(client, 'membre@example.com')
    const body = { password: 'nouveau-mdp-1', passwordConfirmation: 'nouveau-mdp-1' }

    await client.post(path).redirects(0).withCsrfToken().json(body)

    const replay = await client
      .post(path)
      .redirects(0)
      .withCsrfToken()
      .json({ password: 'autre-mdp-22', passwordConfirmation: 'autre-mdp-22' })
    replay.assertStatus(302)
    replay.assertHeader('location', '/fr/password/forgot')

    assert.isTrue(await canLogin('membre@example.com', 'nouveau-mdp-1'))
    assert.isFalse(await canLogin('membre@example.com', 'autre-mdp-22'))
  })

  test('un lien falsifié ou sans signature est refusé', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const path = await requestLink(client, user.email)

    const unsigned = await client.get('/fr/password/reset/' + user.id).redirects(0)
    unsigned.assertStatus(302)
    unsigned.assertHeader('location', '/fr/password/forgot')

    // Même signature, autre compte : la signature couvre le chemin.
    const other = await UserFactory.create()
    const forged = await client
      .post(path.replace(`/reset/${user.id}`, `/reset/${other.id}`))
      .redirects(0)
      .withCsrfToken()
      .json({ password: 'pirate-mdp-12', passwordConfirmation: 'pirate-mdp-12' })
    forged.assertHeader('location', '/fr/password/forgot')

    assert.isTrue(await canLogin(other.email, TEST_PASSWORD))
    assert.isFalse(await canLogin(other.email, 'pirate-mdp-12'))
  })

  test('un mot de passe trop court est rejeté', async ({ client, assert }) => {
    await UserFactory.merge({ email: 'membre@example.com' }).create()
    const path = await requestLink(client, 'membre@example.com')

    const response = await client
      .post(path)
      .redirects(0)
      .withCsrfToken()
      .withInertia()
      .json({ password: 'court', passwordConfirmation: 'court' })

    response.assertStatus(302)
    assert.isTrue(await canLogin('membre@example.com', TEST_PASSWORD))
    assert.isFalse(await canLogin('membre@example.com', 'court'))
  })
})
