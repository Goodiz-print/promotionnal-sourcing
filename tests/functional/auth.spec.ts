import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import hash from '@adonisjs/core/services/hash'

test.group('Auth — inscription & connexion (useForm)', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test("l'inscription crée un compte", async ({ client, assert }) => {
    const response = await client.post('/fr/signup').withInertia().withCsrfToken().json({
      fullName: 'Nouveau Client',
      email: 'nouveau@example.com',
      password: 'password123',
      passwordConfirmation: 'password123',
    })

    response.assertStatus(200)
    assert.isNotNull(await User.findBy('email', 'nouveau@example.com'))
  })

  test('la connexion avec des identifiants valides réussit', async ({ client }) => {
    await User.create({
      email: 'membre@example.com',
      password: await hash.make('password123'),
      fullName: 'Membre',
    })

    const response = await client
      .post('/fr/login')
      .withInertia()
      .withCsrfToken()
      .json({ email: 'membre@example.com', password: 'password123' })

    response.assertStatus(200)
  })
})
