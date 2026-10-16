import { test } from '@japa/runner'
import mail from '@adonisjs/mail/services/main'
import type { ApiClient } from '@japa/api-client'
import { UserFactory } from '#database/factories/user_factory'
import EmailVerificationNotification from '#mails/email_verification_notification'
import User from '#models/user'
import { useDatabase } from '#tests/utils/setup'

test.group('Vérification d’email', (group) => {
  useDatabase(group, { seed: 'roles' })

  let fakeMailer: ReturnType<typeof mail.fake>
  group.each.setup(() => {
    fakeMailer = mail.fake()
    return () => mail.restore()
  })

  /** Chemin + querystring du lien contenu dans le dernier mail de vérification. */
  function sentVerifyPath(): string {
    const sent = fakeMailer.mails.sent((m) => m instanceof EmailVerificationNotification)
    const { verifyUrl } = sent[sent.length - 1] as unknown as { verifyUrl: string }
    const url = new URL(verifyUrl, 'http://localhost')
    return `${url.pathname}${url.search}`
  }

  async function signUp(client: ApiClient, email = 'nouveau@example.com') {
    return client.post('/fr/signup').redirects(0).withCsrfToken().json({
      fullName: 'Nouveau Client',
      email,
      password: 'password123',
      passwordConfirmation: 'password123',
    })
  }

  test("l'inscription envoie le mail de vérification", async ({ client, assert }) => {
    await signUp(client)

    fakeMailer.mails.assertSentCount(EmailVerificationNotification, 1)
    assert.match(sentVerifyPath(), /^\/fr\/email\/verify\/\d+\?.*signature=/)
  })

  test('un compte non vérifié est renvoyé vers l’écran de vérification', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.apply('unverified').create()
    assert.isNull(user.emailVerifiedAt)

    for (const path of ['/fr/onboarding', '/fr/organization/settings', '/fr/rfqs']) {
      const response = await client.get(path).loginAs(user).redirects(0)
      response.assertStatus(302)
      response.assertHeader('location', '/fr/email/verify')
    }

    const notice = await client.get('/fr/email/verify').loginAs(user).withInertia()
    notice.assertStatus(200)
    notice.assertInertiaComponent('auth/verify_email')
  })

  test('un compte vérifié accède à l’onboarding et quitte l’écran de vérification', async ({
    client,
  }) => {
    const user = await UserFactory.create()

    const onboarding = await client.get('/fr/onboarding').loginAs(user).withInertia()
    onboarding.assertStatus(200)

    const notice = await client.get('/fr/email/verify').loginAs(user).redirects(0)
    notice.assertStatus(302)
    notice.assertHeader('location', '/fr')
  })

  test('le lien signé vérifie l’adresse, puis donne accès à l’onboarding', async ({
    client,
    assert,
  }) => {
    await signUp(client)
    const path = sentVerifyPath()
    const user = await User.findByOrFail('email', 'nouveau@example.com')

    const response = await client.get(path).loginAs(user).redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/fr/onboarding')

    await user.refresh()
    assert.isNotNull(user.emailVerifiedAt)

    const onboarding = await client.get('/fr/onboarding').loginAs(user).withInertia()
    onboarding.assertStatus(200)
  })

  test('le lien fonctionne sans session (autre navigateur) et renvoie vers le login', async ({
    client,
    assert,
  }) => {
    await signUp(client)
    const path = sentVerifyPath()

    const response = await client.get(path).redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/fr/login')

    const user = await User.findByOrFail('email', 'nouveau@example.com')
    assert.isNotNull(user.emailVerifiedAt)
  })

  test('un lien falsifié ou sans signature est refusé', async ({ client, assert }) => {
    await signUp(client)
    const path = sentVerifyPath()
    const other = await UserFactory.apply('unverified').create()

    const forged = await client
      .get(path.replace(/\/verify\/\d+/, `/verify/${other.id}`))
      .redirects(0)
    forged.assertHeader('location', '/fr/login')

    const unsigned = await client.get(`/fr/email/verify/${other.id}`).redirects(0)
    unsigned.assertHeader('location', '/fr/login')

    await other.refresh()
    assert.isNull(other.emailVerifiedAt)
  })

  test('changer d’adresse invalide le lien précédent', async ({ client, assert }) => {
    await signUp(client)
    const path = sentVerifyPath()
    const user = await User.findByOrFail('email', 'nouveau@example.com')
    await user.merge({ email: 'autre@example.com' }).save()

    const response = await client.get(path).redirects(0)
    response.assertHeader('location', '/fr/login')

    await user.refresh()
    assert.isNull(user.emailVerifiedAt)
  })

  test('le renvoi envoie un nouveau mail ; sans effet pour un compte déjà vérifié', async ({
    client,
  }) => {
    const unverified = await UserFactory.apply('unverified').create()

    const resend = await client
      .post('/fr/email/verification/resend')
      .loginAs(unverified)
      .redirects(0)
      .withCsrfToken()
    resend.assertStatus(302)
    fakeMailer.mails.assertSentCount(EmailVerificationNotification, 1)

    const verified = await UserFactory.create()
    await client
      .post('/fr/email/verification/resend')
      .loginAs(verified)
      .redirects(0)
      .withCsrfToken()
    fakeMailer.mails.assertSentCount(EmailVerificationNotification, 1)
  })

  test('la déconnexion reste possible tant que l’adresse n’est pas vérifiée', async ({
    client,
  }) => {
    const user = await UserFactory.apply('unverified').create()

    const response = await client.post('/fr/logout').loginAs(user).redirects(0).withCsrfToken()
    response.assertStatus(302)
    response.assertHeader('location', '/fr/login')
  })
})
