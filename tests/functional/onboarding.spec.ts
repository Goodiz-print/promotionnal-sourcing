import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import hash from '@adonisjs/core/services/hash'
import RoleSeeder from '#database/seeders/role_seeder'
import User from '#models/user'
import Organization from '#models/organization'
import OrganizationUser from '#models/organization_user'

async function makeUser(email: string): Promise<User> {
  return User.create({ email, password: await hash.make('password123'), fullName: 'Test' })
}

test.group('Onboarding — création de la 1re organisation', (group) => {
  // Pas de catalogue ici : on sème uniquement les rôles, pour `owner`.
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => new RoleSeeder(db.connection()).run())

  test("l'inscription redirige vers l'onboarding", async ({ client }) => {
    const response = await client.post('/fr/signup').redirects(0).withCsrfToken().json({
      fullName: 'Nouveau',
      email: 'new@example.com',
      password: 'password123',
      passwordConfirmation: 'password123',
    })

    response.assertStatus(302)
    response.assertHeader('location', '/fr/onboarding')
  })

  test("l'écran d'onboarding s'affiche pour un utilisateur sans organisation", async ({
    client,
  }) => {
    const user = await makeUser('orgless@example.com')

    const response = await client.get('/fr/onboarding').withInertia().loginAs(user)

    response.assertStatus(200)
    response.assertInertiaComponent('onboarding/index')
  })

  test('la soumission crée une organisation fournisseur et rattache le user en owner', async ({
    client,
    assert,
  }) => {
    const user = await makeUser('founder@example.com')

    const response = await client
      .post('/fr/onboarding')
      .redirects(0)
      .withCsrfToken()
      .loginAs(user)
      .json({ name: 'Ma Boîte', organizationType: 'supplier' })

    response.assertStatus(302)
    response.assertHeader('location', '/fr')

    const org = await Organization.findByOrFail('slug', 'ma-boite')
    assert.equal(org.name, 'Ma Boîte')
    assert.equal(org.organizationType, 'supplier')

    await user.refresh()
    assert.equal(user.currentOrganizationId, org.id)

    const membership = await OrganizationUser.query()
      .where('userId', user.id)
      .where('organizationId', org.id)
      .preload('role')
      .firstOrFail()
    assert.equal(membership.role.slug, 'owner')
  })

  test("un utilisateur déjà onboardé est renvoyé à l'accueil", async ({ client }) => {
    const user = await makeUser('done@example.com')
    const org = await Organization.create({
      name: 'Déjà là',
      slug: 'deja-la',
      country: 'FR',
      organizationType: 'buyer',
    })
    await user.merge({ currentOrganizationId: org.id }).save()

    const response = await client.get('/fr/onboarding').redirects(0).loginAs(user)

    response.assertStatus(302)
    response.assertHeader('location', '/fr')
  })

  test('un utilisateur sans organisation est bloqué sur les écrans org (middleware)', async ({
    client,
  }) => {
    const user = await makeUser('gated@example.com')

    const response = await client.get('/fr/supplier/profile').redirects(0).loginAs(user)

    response.assertStatus(302)
    response.assertHeader('location', '/fr/onboarding')
  })
})
