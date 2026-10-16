import { test } from '@japa/runner'
import mail from '@adonisjs/mail/services/main'
import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'
import { useDatabase } from '#tests/utils/setup'

test.group('Auth — inscription & connexion (useForm)', (group) => {
  useDatabase(group, { seed: 'none' })
  // L'inscription met un mail de vérification en queue (driver `sync` en test) :
  // sans faux mailer, il tenterait un vrai SMTP et attendrait son timeout.
  group.each.setup(() => {
    mail.fake()
    return () => mail.restore()
  })

  test("l'inscription crée un compte non vérifié et redirige vers l'écran de vérification", async ({
    client,
    assert,
  }) => {
    const response = await client.post('/fr/signup').redirects(0).withCsrfToken().json({
      fullName: 'Nouveau Client',
      email: 'nouveau@example.com',
      password: 'password123',
      passwordConfirmation: 'password123',
    })

    response.assertStatus(302)
    response.assertHeader('location', '/fr/email/verify')
    const user = await User.findByOrFail('email', 'nouveau@example.com')
    assert.isNull(user.emailVerifiedAt)
  })

  test('la connexion avec des identifiants valides réussit', async ({ client }) => {
    await UserFactory.merge({ email: 'membre@example.com' }).create()

    const response = await client
      .post('/fr/login')
      .redirects(0)
      .withCsrfToken()
      .json({ email: 'membre@example.com', password: 'password123' })

    // Membre sans organisation → redirigé vers l'onboarding (302, pas 422/500).
    response.assertStatus(302)
    response.assertHeader('location', '/fr/onboarding')
  })
})
