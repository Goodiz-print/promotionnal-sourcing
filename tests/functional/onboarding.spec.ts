import { test } from '@japa/runner'
import mail from '@adonisjs/mail/services/main'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import Organization from '#models/organization'
import OrganizationUser from '#models/organization_user'
import { useDatabase } from '#tests/utils/setup'

test.group('Onboarding — création de la 1re organisation', (group) => {
  useDatabase(group)
  // L'inscription met un mail de vérification en queue (driver `sync` en test) :
  // sans faux mailer, il tenterait un vrai SMTP et attendrait son timeout.
  group.each.setup(() => {
    mail.fake()
    return () => mail.restore()
  })

  test("l'inscription redirige vers la vérification d'email avant l'onboarding", async ({
    client,
  }) => {
    const response = await client.post('/fr/signup').redirects(0).withCsrfToken().json({
      fullName: 'Nouveau',
      email: 'new@example.com',
      password: 'password123',
      passwordConfirmation: 'password123',
    })

    response.assertStatus(302)
    response.assertHeader('location', '/fr/email/verify')
  })

  test("l'écran d'onboarding s'affiche pour un utilisateur sans organisation", async ({
    client,
  }) => {
    const user = await UserFactory.create()

    const response = await client.get('/fr/onboarding').withInertia().loginAs(user)

    response.assertStatus(200)
    response.assertInertiaComponent('onboarding/index')
  })

  test('la soumission crée une organisation fournisseur et rattache le user en owner', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()

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
    const user = await UserFactory.create()
    const org = await OrganizationFactory.create()
    await user.merge({ currentOrganizationId: org.id }).save()

    const response = await client.get('/fr/onboarding').redirects(0).loginAs(user)

    response.assertStatus(302)
    response.assertHeader('location', '/fr')
  })

  test('un utilisateur sans organisation est bloqué sur les écrans org (middleware)', async ({
    client,
  }) => {
    const user = await UserFactory.create()

    const response = await client.get('/fr/supplier/profile').redirects(0).loginAs(user)

    response.assertStatus(302)
    response.assertHeader('location', '/fr/onboarding')
  })
})
