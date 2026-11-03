import { test } from '@japa/runner'
import { UserFactory } from '#database/factories/user_factory'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { RfqFactory } from '#database/factories/rfq_factory'
import Organization from '#models/organization'
import Product from '#models/product'
import Rfq from '#models/rfq'
import User from '#models/user'
import { createOrganizationWithOwner } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'

test.group('Back-office — tableau de bord', (group) => {
  useDatabase(group, { seed: 'full' })

  test('affiche les compteurs plateforme', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await OrganizationFactory.apply('archived').create()
    const { organization } = await createOrganizationWithOwner()
    await RfqFactory.merge({ buyerOrganizationId: organization.id }).create()

    const response = await client.get('/fr/admin').withInertia().loginAs(admin)

    response.assertStatus(200)
    response.assertInertiaComponent('admin/dashboard')

    const total = async (query: {
      count: (column: string) => { firstOrFail: () => Promise<{ $extras: { total?: unknown } }> }
    }) => {
      const row = await query.count('* as total').firstOrFail()
      return Number(row.$extras.total)
    }
    const stats = response.inertiaProps.stats
    assert.equal(stats.organizations, await total(Organization.query().whereNull('archivedAt')))
    assert.equal(stats.archivedOrganizations, 1)
    assert.equal(stats.users, await total(User.query()))
    assert.equal(stats.products, await total(Product.query()))
    assert.equal(stats.rfqs, await total(Rfq.query()))
    assert.isAbove(stats.products, 0)
    assert.isAtLeast(stats.pendingModeration, stats.products)
    assert.isAtLeast(stats.rfqs, 1)
  })
})
