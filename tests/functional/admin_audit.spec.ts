import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import CategorySeeder from '#database/seeders/category_seeder'
import { AdminAuditLogFactory } from '#database/factories/admin_audit_log_factory'
import { UserFactory } from '#database/factories/user_factory'
import AdminAuditLog from '#models/admin_audit_log'
import Category from '#models/category'
import { useDatabase } from '#tests/utils/setup'

const CONTENT = {
  fr: { name: 'Gourdes', description: 'Bouteilles réutilisables' },
  en: { name: 'Bottles', description: 'Reusable bottles' },
}

interface ListedEntry {
  id: number
  action: string
  actorEmail: string | null
  targetType: string | null
}

test.group('Journal d’audit — consultation', (group) => {
  useDatabase(group)

  test('liste les entrées de la plus récente à la plus ancienne', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const old = await AdminAuditLogFactory.merge({
      createdAt: DateTime.now().minus({ days: 2 }),
    }).create()
    const recent = await AdminAuditLogFactory.merge({
      createdAt: DateTime.now().minus({ hours: 1 }),
    }).create()

    const response = await client.get('/fr/admin/audit').withInertia().loginAs(admin)

    response.assertStatus(200)
    response.assertInertiaComponent('admin/audit/index')
    const ids = response.inertiaProps.entries.data.map((entry: ListedEntry) => entry.id)
    assert.deepEqual(ids, [recent.id, old.id])
    assert.equal(response.inertiaProps.entries.meta.total, 2)
  })

  test('filtre par action et par type de cible', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await AdminAuditLogFactory.create()
    const category = await AdminAuditLogFactory.merge({
      action: 'category.created',
      targetType: 'category',
    }).create()

    const byAction = await client
      .get('/fr/admin/audit?action=category.created')
      .withInertia()
      .loginAs(admin)
    const byTarget = await client
      .get('/fr/admin/audit?targetType=category')
      .withInertia()
      .loginAs(admin)

    for (const response of [byAction, byTarget]) {
      const ids = response.inertiaProps.entries.data.map((entry: ListedEntry) => entry.id)
      assert.deepEqual(ids, [category.id])
    }
    assert.equal(byAction.inertiaProps.filters.action, 'category.created')
  })

  test('filtre par acteur (partiel, sans casse, jokers littéraux)', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const target = await AdminAuditLogFactory.merge({ actorEmail: 'Jane.Doe@acme.io' }).create()
    await AdminAuditLogFactory.merge({ actorEmail: 'autre@exemple.fr' }).create()

    const partial = await client.get('/fr/admin/audit?actor=jane.DOE').withInertia().loginAs(admin)
    const wildcard = await client.get('/fr/admin/audit?actor=%25').withInertia().loginAs(admin)

    assert.deepEqual(
      partial.inertiaProps.entries.data.map((entry: ListedEntry) => entry.id),
      [target.id]
    )
    assert.lengthOf(wildcard.inertiaProps.entries.data, 0)
  })

  test('filtre par période, bornes incluses', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const inside = await AdminAuditLogFactory.merge({
      createdAt: DateTime.fromISO('2026-03-10T23:30:00'),
    }).create()
    await AdminAuditLogFactory.merge({
      createdAt: DateTime.fromISO('2026-03-09T23:59:00'),
    }).create()
    await AdminAuditLogFactory.merge({
      createdAt: DateTime.fromISO('2026-03-11T00:01:00'),
    }).create()

    const response = await client
      .get('/fr/admin/audit?from=2026-03-10&to=2026-03-10')
      .withInertia()
      .loginAs(admin)

    assert.deepEqual(
      response.inertiaProps.entries.data.map((entry: ListedEntry) => entry.id),
      [inside.id]
    )
  })

  test('un filtre invalide est refusé, pas ignoré', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await client.get('/fr/admin/audit?action=inconnue').redirects(0).loginAs(admin)

    response.assertStatus(302)
  })

  for (const role of ['platformModerator', 'platformSupport', 'platformAnalyst'] as const) {
    test(`le rôle ${role} ne lit pas le journal (403)`, async ({ client }) => {
      const user = await UserFactory.apply(role).create()

      const response = await client.get('/fr/admin/audit').withInertia().loginAs(user)

      response.assertStatus(403)
    })
  }

  test('l’entrée survit à la suppression du compte acteur (email conservé)', async ({ assert }) => {
    const actor = await UserFactory.create()
    const entry = await AdminAuditLogFactory.merge({
      actorUserId: actor.id,
      actorEmail: actor.email,
    }).create()

    await actor.delete()
    await entry.refresh()

    assert.isNull(entry.actorUserId)
    assert.equal(entry.actorEmail, actor.email)
  })
})

test.group('Journal d’audit — actions sur les catégories', (group) => {
  useDatabase(group, { extraSeeders: [CategorySeeder] })

  test('création, modification et suppression sont tracées avec l’acteur', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    await client
      .post('/fr/admin/categories')
      .redirects(0)
      .withCsrfToken()
      .loginAs(admin)
      .json({ slug: 'gourdes', parentId: null, sourceLocale: 'fr', translations: CONTENT })
    const category = await Category.findByOrFail('slug', 'gourdes')

    await client
      .patch(`/fr/admin/categories/${category.id}`)
      .redirects(0)
      .withCsrfToken()
      .loginAs(admin)
      .json({ translations: { fr: { name: 'Gourdes isothermes' } } })

    await client
      .delete(`/fr/admin/categories/${category.id}`)
      .redirects(0)
      .withCsrfToken()
      .loginAs(admin)

    const entries = await AdminAuditLog.query().where('target_id', category.id).orderBy('id')
    assert.deepEqual(
      entries.map((entry) => entry.action),
      ['category.created', 'category.updated', 'category.deleted']
    )
    for (const entry of entries) {
      assert.equal(entry.actorUserId, admin.id)
      assert.equal(entry.targetType, 'category')
    }
    assert.deepEqual(entries[0].changes, { after: { slug: 'gourdes', parentId: null } })
    assert.deepEqual(entries[2].changes, { before: { slug: 'gourdes', parentId: null } })
  })

  test('un refus de validation n’écrit aucune entrée', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    // 'crayon' existe déjà (CategorySeeder) → échec de validation.
    await client
      .post('/fr/admin/categories')
      .redirects(0)
      .withCsrfToken()
      .loginAs(admin)
      .json({ slug: 'crayon', parentId: null, sourceLocale: 'fr', translations: CONTENT })

    assert.lengthOf(await AdminAuditLog.all(), 0)
  })

  test('une suppression bloquée (sous-catégories) n’écrit aucune entrée', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const parent = await Category.query()
      .whereHas('children', () => {})
      .firstOrFail()

    await client
      .delete(`/fr/admin/categories/${parent.id}`)
      .redirects(0)
      .withCsrfToken()
      .loginAs(admin)

    assert.lengthOf(await AdminAuditLog.all(), 0)
  })
})
