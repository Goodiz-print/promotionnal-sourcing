import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'

test.group('Auth — inscription & connexion (useForm)', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test("l'inscription crée un compte et redirige vers l'onboarding", async ({ client, assert }) => {
    const response = await client.post('/fr/signup').redirects(0).withCsrfToken().json({
      fullName: 'Nouveau Client',
      email: 'nouveau@example.com',
      password: 'password123',
      passwordConfirmation: 'password123',
    })

    response.assertStatus(302)
    response.assertHeader('location', '/fr/onboarding')
    assert.isNotNull(await User.findBy('email', 'nouveau@example.com'))
  })

  test('la connexion avec des identifiants valides réussit', async ({ client }) => {
    // Mot de passe en clair : le modèle User (withAuthFinder) le hache au save.
    await User.create({
      email: 'membre@example.com',
      password: 'password123',
      fullName: 'Membre',
    })

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
