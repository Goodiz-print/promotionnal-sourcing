import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import type { ApiClient } from '@japa/api-client'
import AdminAuditLog from '#models/admin_audit_log'
import type User from '#models/user'
import { UserFactory } from '#database/factories/user_factory'
import AdminGrant from '../../commands/admin_grant.js'
import { useDatabase } from '#tests/utils/setup'
import type { PlatformRole } from '#shared/types/user'

type FineRole = Exclude<PlatformRole, 'none' | 'admin'>

const STATE: Record<PlatformRole, string | null> = {
  none: null,
  admin: 'platformAdmin',
  moderator: 'platformModerator',
  support: 'platformSupport',
  analyst: 'platformAnalyst',
}

function userWithRole(role: PlatformRole): Promise<User> {
  const state = STATE[role]
  return state ? UserFactory.apply(state as 'platformAdmin').create() : UserFactory.create()
}

/**
 * Statut HTTP attendu de chaque section du back-office selon le rôle plateforme
 * (cf. matrice `PLATFORM_ROLE_PERMISSIONS`).
 */
const ACCESS: Record<string, Record<FineRole | 'admin', number>> = {
  '/fr/admin': { admin: 200, moderator: 200, support: 200, analyst: 200 },
  '/fr/admin/organizations': { admin: 200, moderator: 200, support: 200, analyst: 403 },
  '/fr/admin/users': { admin: 200, moderator: 403, support: 200, analyst: 403 },
  '/fr/admin/categories': { admin: 200, moderator: 403, support: 403, analyst: 403 },
  '/fr/admin/attributes': { admin: 200, moderator: 403, support: 403, analyst: 403 },
  '/fr/admin/audit': { admin: 200, moderator: 403, support: 403, analyst: 403 },
  '/fr/admin/moderation': { admin: 200, moderator: 200, support: 403, analyst: 403 },
}

test.group('Rôles plateforme fins — accès par section', (group) => {
  useDatabase(group)

  for (const [url, expected] of Object.entries(ACCESS)) {
    for (const [role, status] of Object.entries(expected)) {
      test(`${role} → ${status} sur ${url}`, async ({ client }) => {
        const user = await userWithRole(role as PlatformRole)

        const response = await client.get(url).withInertia().loginAs(user)

        response.assertStatus(status)
      })
    }
  }

  test('un compte sans rôle plateforme reçoit 403 partout', async ({ client }) => {
    const user = await userWithRole('none')

    for (const url of Object.keys(ACCESS)) {
      const response = await client.get(url).withInertia().loginAs(user)
      response.assertStatus(403)
    }
  })

  test('le menu propose Administration à tout rôle plateforme, pas aux autres', async ({
    client,
    assert,
  }) => {
    for (const role of ['admin', 'moderator', 'support', 'analyst'] as const) {
      const user = await userWithRole(role)
      const response = await client.get('/fr/admin').withInertia().loginAs(user)
      const routes = response.inertiaProps.navigation.map((item: { route: string }) => item.route)
      assert.include(routes, 'admin.dashboard', role)
      assert.equal(response.inertiaProps.user.platformRole, role)
    }

    const ordinary = await userWithRole('none')
    const response = await client.get('/fr/account').withInertia().loginAs(ordinary)
    const routes = response.inertiaProps.navigation.map((item: { route: string }) => item.route)
    assert.notInclude(routes, 'admin.dashboard')
  })

  test('isPlatformAdmin reste réservé au rôle admin', async ({ client, assert }) => {
    const moderator = await userWithRole('moderator')

    const response = await client.get('/fr/admin').withInertia().loginAs(moderator)

    assert.isFalse(response.inertiaProps.user.isPlatformAdmin)
  })
})

test.group('Rôles plateforme fins — attribution depuis l’écran Utilisateurs', (group) => {
  useDatabase(group)

  function changeRole(client: ApiClient, actor: User, targetId: number, platformRole: string) {
    return client
      .patch(`/fr/admin/users/${targetId}/platform-role`)
      .redirects(0)
      .withCsrfToken()
      .loginAs(actor)
      .json({ platformRole })
  }

  test('un admin attribue un rôle fin et l’opération est auditée', async ({ client, assert }) => {
    const admin = await userWithRole('admin')
    const target = await userWithRole('none')

    const response = await changeRole(client, admin, target.id, 'moderator')

    response.assertStatus(302)
    await target.refresh()
    assert.equal(target.platformRole, 'moderator')

    const entry = await AdminAuditLog.query().where('action', 'platform_role.changed').firstOrFail()
    assert.equal(entry.actorUserId, admin.id)
    assert.equal(entry.actorEmail, admin.email)
    assert.equal(entry.targetType, 'user')
    assert.equal(entry.targetId, target.id)
    assert.deepEqual(entry.changes, {
      before: { platformRole: 'none' },
      after: { platformRole: 'moderator' },
    })
    assert.isNotNull(entry.ipAddress)
  })

  test('un admin peut retirer le rôle d’un autre compte', async ({ client, assert }) => {
    const admin = await userWithRole('admin')
    const target = await userWithRole('support')

    await changeRole(client, admin, target.id, 'none')

    await target.refresh()
    assert.equal(target.platformRole, 'none')
  })

  for (const role of ['moderator', 'support', 'analyst'] as const) {
    test(`un ${role} ne peut pas attribuer de rôle (refus, sans effet ni audit)`, async ({
      client,
      assert,
    }) => {
      const actor = await userWithRole(role)
      const target = await userWithRole('none')

      const response = await changeRole(client, actor, target.id, 'admin')

      // Refus d'une écriture : le 403 devient une redirection avec flash.
      assert.isAtLeast(response.status(), 302)
      await target.refresh()
      assert.equal(target.platformRole, 'none')
      assert.lengthOf(await AdminAuditLog.all(), 0)
    })
  }

  test('un admin ne peut pas modifier son propre rôle', async ({ client, assert }) => {
    const admin = await userWithRole('admin')

    const response = await changeRole(client, admin, admin.id, 'none')

    response.assertStatus(302)
    await admin.refresh()
    assert.equal(admin.platformRole, 'admin')
    assert.lengthOf(await AdminAuditLog.all(), 0)
  })

  test('réattribuer le rôle déjà porté est sans effet et sans trace', async ({
    client,
    assert,
  }) => {
    const admin = await userWithRole('admin')
    const target = await userWithRole('analyst')

    await changeRole(client, admin, target.id, 'analyst')

    assert.lengthOf(await AdminAuditLog.all(), 0)
  })

  test('un rôle inconnu est refusé par la validation', async ({ client, assert }) => {
    const admin = await userWithRole('admin')
    const target = await userWithRole('none')

    const response = await changeRole(client, admin, target.id, 'superuser')

    response.assertStatus(302)
    await target.refresh()
    assert.equal(target.platformRole, 'none')
    assert.lengthOf(await AdminAuditLog.all(), 0)
  })

  test('un compte inconnu n’est pas modifiable', async ({ client, assert }) => {
    const admin = await userWithRole('admin')

    const response = await changeRole(client, admin, 999_999, 'moderator')

    assert.oneOf(response.status(), [302, 404])
  })

  test('l’écran Utilisateurs expose canManageRoles selon le droit', async ({ client, assert }) => {
    const admin = await userWithRole('admin')
    const support = await userWithRole('support')

    const asAdmin = await client.get('/fr/admin/users').withInertia().loginAs(admin)
    const asSupport = await client.get('/fr/admin/users').withInertia().loginAs(support)

    assert.isTrue(asAdmin.inertiaProps.canManageRoles)
    assert.equal(asAdmin.inertiaProps.currentUserId, admin.id)
    assert.isFalse(asSupport.inertiaProps.canManageRoles)
  })
})

test.group('Rôles plateforme fins — commande admin:grant', (group) => {
  useDatabase(group, { seed: 'none' })

  test('admin:grant est audité, sans acteur, avec l’origine « cli »', async ({ assert }) => {
    const user = await UserFactory.create()

    const grant = await ace.create(AdminGrant, [user.email])
    await grant.exec()
    grant.assertSucceeded()

    const entry = await AdminAuditLog.query().where('action', 'platform_role.changed').firstOrFail()
    assert.isNull(entry.actorUserId)
    assert.isNull(entry.actorEmail)
    assert.equal(entry.targetId, user.id)
    assert.deepEqual(entry.changes, {
      before: { platformRole: 'none' },
      after: { platformRole: 'admin' },
      source: 'cli',
    })
  })
})
