import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import hash from '@adonisjs/core/services/hash'
import env from '#start/env'
import Organization from '#models/organization'
import OrganizationUser from '#models/organization_user'
import Supplier from '#models/supplier'
import User from '#models/user'
import StagingAccountSeeder from '#database/seeders/staging_account_seeder'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { SupplierFactory } from '#database/factories/supplier_factory'
import { DEV_DEMO_PASSWORD } from '#shared/helpers/seed'
import { useDatabase } from '#tests/utils/setup'

const ADMIN_EMAILS = 'alice@example.com, bob@example.com'

function runSeeder() {
  return new StagingAccountSeeder(db.connection()).run()
}

test.group('StagingAccountSeeder — comptes des tests utilisateurs', (group) => {
  useDatabase(group)

  group.each.setup(() => {
    env.set('SEED_ADMIN_EMAILS', ADMIN_EMAILS)
    return () => env.set('SEED_ADMIN_EMAILS', '')
  })

  test('sans SEED_ADMIN_EMAILS, ne crée rien', async ({ assert }) => {
    env.set('SEED_ADMIN_EMAILS', '')

    await runSeeder()

    assert.isNull(await User.findBy('email', 'agence-1@promotionnal-sourcing.test'))
    assert.isNull(await User.findBy('email', 'alice@example.com'))
  })

  test('crée les admins nominatifs, sans organisation', async ({ assert }) => {
    await runSeeder()

    const admins = await User.query().whereIn('email', ['alice@example.com', 'bob@example.com'])
    assert.lengthOf(admins, 2)
    admins.forEach((admin) => {
      assert.equal(admin.platformRole, 'admin')
      assert.isNull(admin.currentOrganizationId)
      assert.isNotNull(admin.emailVerifiedAt)
    })
    assert.isTrue(await hash.verify(admins[0].password, DEV_DEMO_PASSWORD))
  })

  test('crée 5 agences et 4 fournisseurs, chacun owner de sa propre organisation', async ({
    assert,
  }) => {
    await runSeeder()

    const agency = await Organization.findByOrFail('slug', 'agence-test-3')
    const supplierOrg = await Organization.findByOrFail('slug', 'makito-org')
    const owner = await User.findByOrFail('email', 'fournisseur-makito@promotionnal-sourcing.test')
    const membership = await OrganizationUser.query()
      .where('userId', owner.id)
      .preload('role')
      .firstOrFail()

    assert.equal(agency.organizationType, 'buyer')
    assert.equal(supplierOrg.organizationType, 'supplier')
    assert.equal(membership.organizationId, supplierOrg.id)
    assert.equal(membership.role.slug, 'owner')
    assert.equal(owner.currentOrganizationId, supplierOrg.id)
    assert.lengthOf(await Organization.query().whereLike('slug', 'agence-test-%'), 5)
  })

  test('rattache la fiche importée à son fournisseur fictif', async ({ assert }) => {
    const imported = await SupplierFactory.merge({ slug: 'makito', organizationId: null }).create()

    await runSeeder()

    await imported.refresh()
    const supplierOrg = await Organization.findByOrFail('slug', 'makito-org')
    const alice = await User.findByOrFail('email', 'alice@example.com')
    assert.equal(imported.organizationId, supplierOrg.id)
    assert.equal(imported.linkedByUserId, alice.id)
    assert.isNotNull(imported.linkedAt)
  })

  test('ne touche pas une fiche déjà rattachée ni une fiche absente', async ({ assert }) => {
    const realOrg = await OrganizationFactory.merge({ organizationType: 'supplier' }).create()
    const linked = await SupplierFactory.merge({
      slug: 'inspirion',
      organizationId: realOrg.id,
    }).create()

    await runSeeder()

    await linked.refresh()
    assert.equal(linked.organizationId, realOrg.id)
    assert.isNull(await Supplier.findBy('slug', 'pf-concept'))
  })

  test('relançable : aucun doublon', async ({ assert }) => {
    await runSeeder()
    await runSeeder()

    const agencies = await User.query().where('email', 'agence-1@promotionnal-sourcing.test')
    const memberships = await OrganizationUser.query().where('userId', agencies[0].id)
    assert.lengthOf(agencies, 1)
    assert.lengthOf(memberships, 1)
    assert.lengthOf(await Organization.query().where('slug', 'makito-org'), 1)
  })
})
