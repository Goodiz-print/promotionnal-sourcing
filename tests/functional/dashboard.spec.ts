import { test } from '@japa/runner'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { RfqFactory } from '#database/factories/rfq_factory'
import { RfqSupplierFactory } from '#database/factories/rfq_supplier_factory'
import { TEST_PASSWORD, UserFactory } from '#database/factories/user_factory'
import { createMember, seededDevUser } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'

test.group('Tableau de bord — accès', (group) => {
  useDatabase(group, { seed: 'roles' })

  test('un visiteur anonyme est renvoyé vers la connexion', async ({ client, assert }) => {
    const response = await client.get('/fr/dashboard').redirects(0)

    response.assertStatus(302)
    assert.include(response.header('location'), '/login')
  })

  test("un utilisateur sans organisation est renvoyé vers l'onboarding", async ({ client }) => {
    const user = await UserFactory.create()

    const response = await client.get('/fr/dashboard').redirects(0).loginAs(user)

    response.assertStatus(302)
    response.assertHeader('location', '/fr/onboarding')
  })

  test("après connexion, un membre d'une organisation atterrit sur le tableau de bord", async ({
    client,
  }) => {
    await createMember(await OrganizationFactory.create(), 'owner', {
      email: 'owner@example.com',
    })
    const response = await client
      .post('/fr/login')
      .redirects(0)
      .withCsrfToken()
      .json({ email: 'owner@example.com', password: TEST_PASSWORD })

    response.assertStatus(302)
    response.assertHeader('location', '/fr/dashboard')
  })
})

test.group('Tableau de bord — acheteur', (group) => {
  useDatabase(group, { seed: 'roles' })

  test("n'expose que le bloc acheteur, avec les compteurs par statut", async ({
    client,
    assert,
  }) => {
    const buyer = await OrganizationFactory.create()
    const owner = await createMember(buyer, 'owner')
    await RfqFactory.merge({ buyerOrganizationId: buyer.id }).createMany(2)
    await RfqFactory.apply('published').merge({ buyerOrganizationId: buyer.id }).create()
    // Demande d'une autre organisation : ne doit pas être comptée.
    const other = await OrganizationFactory.create()
    await RfqFactory.merge({ buyerOrganizationId: other.id }).create()

    const response = await client.get('/fr/dashboard').withInertia().loginAs(owner)

    response.assertStatus(200)
    response.assertInertiaComponent('dashboard/show')
    const { dashboard } = response.inertiaProps
    assert.isUndefined(dashboard.supplier)
    assert.deepEqual(dashboard.buyer.rfqCounts, { draft: 2, published: 1, closed: 0, expired: 0 })
    assert.deepEqual(dashboard.buyer.recentResponses, [])
  })

  test('liste les dernières réponses fournisseurs des demandes de cette organisation', async ({
    client,
    assert,
  }) => {
    const buyer = await OrganizationFactory.create()
    const owner = await createMember(buyer, 'owner')
    const supplier = await OrganizationFactory.apply('supplier').merge({ name: 'Acme' }).create()
    const rfq = await RfqFactory.apply('published')
      .merge({ buyerOrganizationId: buyer.id, title: 'Tote bags' })
      .create()
    await RfqSupplierFactory.merge({
      rfqId: rfq.id,
      supplierOrganizationId: supplier.id,
      status: 'responded',
    }).create()
    // Fournisseur qui n'a pas répondu : absent de la liste.
    const silent = await OrganizationFactory.apply('supplier').create()
    await RfqSupplierFactory.apply('sent')
      .merge({ rfqId: rfq.id, supplierOrganizationId: silent.id })
      .create()

    const response = await client.get('/fr/dashboard').withInertia().loginAs(owner)

    const { recentResponses } = response.inertiaProps.dashboard.buyer
    assert.lengthOf(recentResponses, 1)
    assert.equal(recentResponses[0].rfqId, rfq.id)
    assert.equal(recentResponses[0].rfqTitle, 'Tote bags')
    assert.equal(recentResponses[0].supplierName, 'Acme')
  })
})

test.group('Tableau de bord — fournisseur', (group) => {
  useDatabase(group, { seed: 'full' })

  test("n'expose que le bloc fournisseur, avec demandes non lues, produits actifs et complétude", async ({
    client,
    assert,
  }) => {
    const user = await seededDevUser('eurogoods-org')
    const buyer = await OrganizationFactory.create()
    const rfq = await RfqFactory.apply('published')
      .merge({ buyerOrganizationId: buyer.id })
      .create()
    await RfqSupplierFactory.apply('sent')
      .merge({ rfqId: rfq.id, supplierOrganizationId: user.currentOrganizationId! })
      .create()

    const response = await client.get('/fr/dashboard').withInertia().loginAs(user)

    response.assertStatus(200)
    const { dashboard } = response.inertiaProps
    assert.isUndefined(dashboard.buyer)
    assert.equal(dashboard.supplier.unreadRfqs, 1)
    assert.isAtLeast(dashboard.supplier.activeProducts, 1)
    assert.isAtLeast(dashboard.supplier.profileCompleteness, 0)
    assert.isAtMost(dashboard.supplier.profileCompleteness, 100)
  })

  test('une organisation « both » reçoit les deux blocs', async ({ client, assert }) => {
    const organization = await OrganizationFactory.apply('both').create()
    const owner = await createMember(organization, 'owner')

    const response = await client.get('/fr/dashboard').withInertia().loginAs(owner)

    const { dashboard } = response.inertiaProps
    assert.exists(dashboard.buyer)
    assert.exists(dashboard.supplier)
    assert.equal(dashboard.supplier.profileCompleteness, 0)
  })
})
