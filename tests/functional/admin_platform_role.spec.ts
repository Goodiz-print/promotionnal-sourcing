import { test } from '@japa/runner'
import type { Assert } from '@japa/assert'
import ace from '@adonisjs/core/services/ace'
import app from '@adonisjs/core/services/app'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import AdminGrant from '../../commands/admin_grant.js'
import AdminRevoke from '../../commands/admin_revoke.js'
import User from '#models/user'
import OrganizationUser from '#models/organization_user'
import db from '@adonisjs/lucid/services/db'
import PlatformAdminService from '#services/platform_admin_service'
import { PlatformUserNotFoundException } from '#exceptions/admin_errors'
import DevUserSeeder, { DEV_ADMIN_EMAIL } from '#database/seeders/dev_user_seeder'
import { createMember, joinOrganization, seededDevUser } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'
import type { PlatformRole } from '#shared/types/user'

async function assertPlatformRole(
  assert: Assert,
  userId: number,
  expected: PlatformRole
): Promise<void> {
  const user = await User.findOrFail(userId)
  assert.equal(user.platformRole, expected)
}

const ADMIN_ROUTES = [
  '/fr/admin',
  '/fr/admin/organizations',
  '/fr/admin/users',
  '/fr/admin/categories',
] as const

test.group('Rôle plateforme — accès à /admin/**', (group) => {
  useDatabase(group)

  test('un owner d’organisation ordinaire reçoit un 403 sur toutes les routes admin', async ({
    client,
  }) => {
    const organization = await OrganizationFactory.create()
    const owner = await createMember(organization, 'owner')

    for (const url of ADMIN_ROUTES) {
      const response = await client.get(url).withInertia().loginAs(owner)
      response.assertStatus(403)
    }
  })

  test('un admin plateforme accède à toutes les routes admin, quel que soit son rôle d’organisation', async ({
    client,
  }) => {
    const organization = await OrganizationFactory.create()
    const withoutOrganization = await UserFactory.apply('platformAdmin').create()
    const member = await createMember(organization, 'member')
    const owner = await createMember(organization, 'owner')
    await member.merge({ platformRole: 'admin' }).save()
    await owner.merge({ platformRole: 'admin' }).save()

    for (const admin of [withoutOrganization, member, owner]) {
      for (const url of ADMIN_ROUTES) {
        const response = await client.get(url).withInertia().loginAs(admin)
        response.assertStatus(200)
      }
    }
  })

  test('un visiteur anonyme est renvoyé vers la connexion', async ({ client }) => {
    for (const url of ADMIN_ROUTES) {
      const response = await client.get(url).redirects(0)
      response.assertStatus(302)
      response.assertHeader('location', '/login')
    }
  })

  test('l’utilisateur partagé expose isPlatformAdmin au menu', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const ordinary = await UserFactory.create()

    const asAdmin = await client.get('/fr/admin').withInertia().loginAs(admin)
    const asOrdinary = await client.get('/fr/account').withInertia().loginAs(ordinary)

    assert.isTrue(asAdmin.inertiaProps.user.isPlatformAdmin)
    assert.isFalse(asOrdinary.inertiaProps.user.isPlatformAdmin)
  })
})

test.group('Rôle plateforme — commandes admin:grant / admin:revoke', (group) => {
  useDatabase(group, { seed: 'none' })

  test('admin:grant donne le rôle, admin:revoke le retire', async ({ assert }) => {
    const user = await UserFactory.create()
    await user.refresh()
    assert.equal(user.platformRole, 'none')

    const grant = await ace.create(AdminGrant, [user.email])
    await grant.exec()
    grant.assertSucceeded()
    await assertPlatformRole(assert, user.id, 'admin')

    const revoke = await ace.create(AdminRevoke, [user.email])
    await revoke.exec()
    revoke.assertSucceeded()
    await assertPlatformRole(assert, user.id, 'none')
  })

  test('admin:grant échoue proprement sur un email inconnu', async () => {
    const grant = await ace.create(AdminGrant, ['personne@example.com'])
    await grant.exec()
    grant.assertFailed()
  })

  test('l’email est comparé sans tenir compte de la casse', async ({ assert }) => {
    const user = await UserFactory.merge({ email: 'MixedCase@Example.com' }).create()

    const service = await app.container.make(PlatformAdminService)
    await service.grant('  mixedcase@example.com ')

    await assertPlatformRole(assert, user.id, 'admin')
  })

  test('accorder deux fois est sans effet', async ({ assert }) => {
    const user = await UserFactory.create()
    const service = await app.container.make(PlatformAdminService)

    await service.grant(user.email)
    await service.grant(user.email)

    await assertPlatformRole(assert, user.id, 'admin')
  })

  test('le service lève une exception métier sur un email inconnu', async ({ assert }) => {
    await assert.rejects(async () => {
      const service = await app.container.make(PlatformAdminService)
      await service.revoke('personne@example.com')
    }, PlatformUserNotFoundException.message)
  })
})

test.group('Rôle plateforme — comptes de démo', (group) => {
  useDatabase(group, { seed: 'full' })

  test('le compte de démo reste ordinaire, l’admin de démo accède au back-office', async ({
    client,
  }) => {
    const demo = await seededDevUser('promotionnal-sourcing')
    const admin = await User.findByOrFail('email', DEV_ADMIN_EMAIL)

    const refused = await client.get('/fr/admin/categories').withInertia().loginAs(demo)
    const allowed = await client.get('/fr/admin/categories').withInertia().loginAs(admin)

    refused.assertStatus(403)
    allowed.assertStatus(200)
  })

  test("l'admin de démo n'a aucune organisation, même après un nouveau seed", async ({
    assert,
  }) => {
    const admin = await User.findByOrFail('email', DEV_ADMIN_EMAIL)
    const org = await OrganizationFactory.create()
    await joinOrganization(admin, org, 'member')
    await admin.merge({ currentOrganizationId: org.id }).save()

    await new DevUserSeeder(db.connection()).run()

    await admin.refresh()
    const memberships = await OrganizationUser.query().where('userId', admin.id)
    assert.lengthOf(memberships, 0)
    assert.isNull(admin.currentOrganizationId)
    assert.equal(admin.platformRole, 'admin')
  })
})
