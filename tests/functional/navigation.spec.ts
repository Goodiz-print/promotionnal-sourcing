import { test } from '@japa/runner'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'

test.group('Menu applicatif — prop partagée `navigation`', (group) => {
  useDatabase(group, { seed: 'roles' })

  test('un visiteur reçoit le catalogue et les fournisseurs', async ({ client, assert }) => {
    const response = await client.get('/fr/products').withInertia()

    const routes = response.inertiaProps.navigation.map((item: { route: string }) => item.route)
    assert.deepEqual(routes, ['products.index', 'suppliers.index'])
  })

  test("un propriétaire d'organisation fournisseuse reçoit les écrans fournisseur et la gestion", async ({
    client,
    assert,
  }) => {
    const owner = await createMember(await OrganizationFactory.apply('supplier').create(), 'owner')

    const response = await client.get('/fr/dashboard').withInertia().loginAs(owner)

    const routes = response.inertiaProps.navigation.map((item: { route: string }) => item.route)
    assert.includeMembers(routes, [
      'dashboard.show',
      'supplier.products.index',
      'supplier.rfqs.index',
      'supplier.profile',
      'organization.members',
      'organization.settings',
    ])
    assert.notInclude(routes, 'rfqs.index')
  })

  test("un simple membre acheteur n'a ni gestion ni écrans fournisseur", async ({
    client,
    assert,
  }) => {
    const member = await createMember(await OrganizationFactory.create(), 'member')

    const response = await client.get('/fr/dashboard').withInertia().loginAs(member)

    const routes = response.inertiaProps.navigation.map((item: { route: string }) => item.route)
    assert.include(routes, 'rfqs.index')
    assert.notIncludeMembers(routes, [
      'supplier.products.index',
      'organization.members',
      'organization.settings',
    ])
  })

  test("le résumé d'organisation expose son type", async ({ client, assert }) => {
    const owner = await createMember(await OrganizationFactory.apply('both').create(), 'owner')

    const response = await client.get('/fr/dashboard').withInertia().loginAs(owner)

    assert.equal(response.inertiaProps.organizations[0].organizationType, 'both')
  })

  test("l'entrée Administration n'est exposée qu'aux administrateurs plateforme", async ({
    client,
    assert,
  }) => {
    const owner = await createMember(await OrganizationFactory.create(), 'owner')
    const admin = await UserFactory.apply('platformAdmin').create()

    const asOwner = await client.get('/fr/products').withInertia().loginAs(owner)
    const asAdmin = await client.get('/fr/products').withInertia().loginAs(admin)

    const routesOf = (response: typeof asOwner) =>
      response.inertiaProps.navigation.map((item: { route: string }) => item.route)
    assert.notInclude(routesOf(asOwner), 'admin.dashboard')
    assert.include(routesOf(asAdmin), 'admin.dashboard')
  })
})
