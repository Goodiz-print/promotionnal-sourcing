import { test } from '@japa/runner'
import mail from '@adonisjs/mail/services/main'
import type { ApiClient } from '@japa/api-client'
import { UserFactory, TEST_PASSWORD } from '#database/factories/user_factory'
import EmailVerificationNotification from '#mails/email_verification_notification'
import PasswordResetNotification from '#mails/password_reset_notification'
import {
  EMAIL_VERIFICATION_RESEND_LIMIT,
  LOGIN_LIMIT,
  PASSWORD_RESET_LIMIT,
  SIGNUP_LIMIT,
} from '#start/limiter'
import { useDatabase } from '#tests/utils/setup'

test.group('Rate limiting — authentification', (group) => {
  useDatabase(group, { seed: 'none' })

  group.each.setup(() => {
    mail.fake()
    return () => mail.restore()
  })

  const login = (client: ApiClient, email: string, password: string) =>
    client.post('/fr/login').redirects(0).withCsrfToken().json({ email, password })

  test('login : la tentative suivant la limite est bloquée, même avec le bon mot de passe', async ({
    client,
    assert,
  }) => {
    await UserFactory.merge({ email: 'cible@example.com' }).create()

    for (let attempt = 1; attempt <= LOGIN_LIMIT.requests; attempt++) {
      const failed = await login(client, 'cible@example.com', 'mauvais-mdp')
      assert.notMatch(String(failed.flashMessages().error ?? ''), /Trop de tentatives/)
    }

    const blocked = await login(client, 'cible@example.com', TEST_PASSWORD)
    blocked.assertStatus(302)
    assert.match(
      String(blocked.flashMessages().error),
      /^Trop de tentatives\. Réessayez dans \d+ min\.$/
    )
    assert.isDefined(blocked.header('retry-after'))
    // Pas de connexion : le bon mot de passe n'a même pas été évalué (sinon on
    // serait redirigé vers l'onboarding).
    assert.notEqual(blocked.header('location'), '/fr/onboarding')
  })

  test('login : le compteur est propre à chaque email', async ({ client, assert }) => {
    await UserFactory.merge({ email: 'a@example.com' }).create()
    await UserFactory.merge({ email: 'b@example.com' }).create()

    for (let attempt = 0; attempt <= LOGIN_LIMIT.requests; attempt++) {
      await login(client, 'a@example.com', 'mauvais-mdp')
    }

    const other = await login(client, 'b@example.com', TEST_PASSWORD)
    other.assertStatus(302)
    assert.isUndefined(other.flashMessages().error)
  })

  test('login : insensible à la casse de l’email', async ({ client, assert }) => {
    await UserFactory.merge({ email: 'cible@example.com' }).create()

    for (let attempt = 0; attempt < LOGIN_LIMIT.requests; attempt++) {
      await login(client, attempt % 2 ? 'CIBLE@example.com' : 'cible@example.com', 'mauvais-mdp')
    }

    const blocked = await login(client, 'Cible@Example.com', TEST_PASSWORD)
    assert.match(String(blocked.flashMessages().error), /Trop de tentatives/)
  })

  test('login : une connexion réussie remet le compteur à zéro', async ({ client, assert }) => {
    await UserFactory.merge({ email: 'membre@example.com' }).create()

    // Plus de connexions réussies que la limite : elles ne s'additionnent pas.
    for (let attempt = 0; attempt < LOGIN_LIMIT.requests * 2; attempt++) {
      const ok = await login(client, 'membre@example.com', TEST_PASSWORD)
      assert.isUndefined(ok.flashMessages().error)
    }

    // Quelques échecs puis un succès : le succès efface les échecs.
    for (let attempt = 0; attempt < LOGIN_LIMIT.requests - 1; attempt++) {
      await login(client, 'membre@example.com', 'mauvais-mdp')
    }
    await login(client, 'membre@example.com', TEST_PASSWORD)
    for (let attempt = 0; attempt < LOGIN_LIMIT.requests - 1; attempt++) {
      await login(client, 'membre@example.com', 'mauvais-mdp')
    }
    const still = await login(client, 'membre@example.com', TEST_PASSWORD)
    assert.isUndefined(still.flashMessages().error)
  })

  test('un client API reçoit un 429 JSON plutôt qu’une redirection', async ({ client }) => {
    await UserFactory.merge({ email: 'cible@example.com' }).create()
    for (let attempt = 0; attempt < LOGIN_LIMIT.requests; attempt++) {
      await login(client, 'cible@example.com', 'mauvais-mdp')
    }

    const response = await client
      .post('/fr/login')
      .header('Accept', 'application/json')
      .redirects(0)
      .withCsrfToken()
      .json({ email: 'cible@example.com', password: TEST_PASSWORD })

    response.assertStatus(429)
  })

  test('inscription : limitée par IP', async ({ client, assert }) => {
    const signUp = (index: number) =>
      client
        .post('/fr/signup')
        .redirects(0)
        .withCsrfToken()
        .json({
          fullName: 'Nouveau',
          email: `nouveau${index}@example.com`,
          password: 'password123',
          passwordConfirmation: 'password123',
        })

    for (let index = 1; index <= SIGNUP_LIMIT.requests; index++) {
      const created = await signUp(index)
      created.assertHeader('location', '/fr/email/verify')
    }

    const blocked = await signUp(SIGNUP_LIMIT.requests + 1)
    blocked.assertStatus(302)
    assert.match(String(blocked.flashMessages().error), /Trop de tentatives/)
  })

  test('mot de passe oublié : limité par email, sans mail supplémentaire', async ({
    client,
    assert,
  }) => {
    await UserFactory.merge({ email: 'membre@example.com' }).create()
    const fake = mail.fake()
    const forgot = (email: string) =>
      client.post('/fr/password/forgot').redirects(0).withCsrfToken().json({ email })

    for (let attempt = 0; attempt < PASSWORD_RESET_LIMIT.requests; attempt++) {
      await forgot(attempt % 2 ? 'MEMBRE@example.com' : 'membre@example.com')
    }
    fake.mails.assertSentCount(PasswordResetNotification, PASSWORD_RESET_LIMIT.requests)

    const blocked = await forgot('membre@example.com')
    assert.match(String(blocked.flashMessages().error), /Trop de tentatives/)
    fake.mails.assertSentCount(PasswordResetNotification, PASSWORD_RESET_LIMIT.requests)

    // Un autre email n'est pas touché (et reste sans énumération : réponse 302).
    const other = await forgot('autre@example.com')
    other.assertStatus(302)
    assert.isUndefined(other.flashMessages().error)
  })

  test('renvoi du mail de vérification : limité par compte', async ({ client, assert }) => {
    const user = await UserFactory.apply('unverified').create()
    const fake = mail.fake()
    const resend = () =>
      client.post('/fr/email/verification/resend').loginAs(user).redirects(0).withCsrfToken()

    for (let attempt = 0; attempt < EMAIL_VERIFICATION_RESEND_LIMIT.requests; attempt++) {
      await resend()
    }
    fake.mails.assertSentCount(
      EmailVerificationNotification,
      EMAIL_VERIFICATION_RESEND_LIMIT.requests
    )

    const blocked = await resend()
    assert.match(String(blocked.flashMessages().error), /Trop de tentatives/)
    fake.mails.assertSentCount(
      EmailVerificationNotification,
      EMAIL_VERIFICATION_RESEND_LIMIT.requests
    )
  })
})
