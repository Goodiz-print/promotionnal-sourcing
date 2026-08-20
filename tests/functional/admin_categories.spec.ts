import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import hash from '@adonisjs/core/services/hash'
import testUtils from '@adonisjs/core/services/test_utils'
import RoleSeeder from '#database/seeders/role_seeder'
import PermissionSeeder from '#database/seeders/permission_seeder'
import RolePermissionSeeder from '#database/seeders/role_permission_seeder'
import CategorySeeder from '#database/seeders/category_seeder'
import User from '#models/user'
import Role from '#models/role'
import Organization from '#models/organization'
import OrganizationUser from '#models/organization_user'
import Category from '#models/category'
import CategoryTranslation from '#models/category_translation'

/**
 * Crée un utilisateur rattaché à une organisation avec le rôle demandé, et en
 * fait son organisation courante.
 */
async function makeMember(email: string, orgSlug: string, roleSlug: string): Promise<User> {
  const role = await Role.findByOrFail('slug', roleSlug)
  const user = await User.create({
    email,
    password: await hash.make('password123'),
    fullName: 'Test',
  })
  const org = await Organization.create({
    name: orgSlug,
    slug: orgSlug,
    country: 'FR',
    organizationType: 'buyer',
  })
  await OrganizationUser.create({ userId: user.id, organizationId: org.id, roleId: role.id })
  await user.merge({ currentOrganizationId: org.id }).save()
  return user
}

const CONTENT = {
  fr: { name: 'Vêtements', description: 'Textile publicitaire' },
  en: { name: 'Apparel', description: 'Promotional textile' },
}

test.group('Administration des catégories — CRUD + ACL', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(async () => {
    await new RoleSeeder(db.connection()).run()
    await new PermissionSeeder(db.connection()).run()
    await new RolePermissionSeeder(db.connection()).run()
    await new CategorySeeder(db.connection()).run()
  })

  test("l'owner voit la liste des catégories", async ({ client }) => {
    const owner = await makeMember('owner@example.com', 'admin-org', 'owner')

    const response = await client.get('/fr/admin/categories').withInertia().loginAs(owner)

    response.assertStatus(200)
    response.assertInertiaComponent('admin/categories/index')
  })

  test('un membre ne peut pas gérer les catégories (403)', async ({ client }) => {
    const member = await makeMember('member@example.com', 'member-org', 'member')

    const response = await client.get('/fr/admin/categories').withInertia().loginAs(member)

    response.assertStatus(403)
  })

  test('un utilisateur sans organisation est renvoyé vers l’onboarding', async ({ client }) => {
    const user = await User.create({
      email: 'orgless@example.com',
      password: await hash.make('password123'),
      fullName: 'Sans org',
    })

    const response = await client.get('/fr/admin/categories').redirects(0).loginAs(user)

    response.assertStatus(302)
    response.assertHeader('location', '/fr/onboarding')
  })

  test('création d’une catégorie avec ses traductions', async ({ client, assert }) => {
    const owner = await makeMember('creator@example.com', 'creator-org', 'owner')

    const response = await client
      .post('/fr/admin/categories')
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)
      .json({
        slug: 'vetements',
        parentId: null,
        synonyms: ['tshirt', 'textile'],
        translations: CONTENT,
      })

    response.assertStatus(200)
    response.assertInertiaComponent('admin/categories/index')

    const category = await Category.findByOrFail('slug', 'vetements')
    assert.deepEqual(category.synonyms, ['tshirt', 'textile'])

    const fr = await CategoryTranslation.query()
      .where('categoryId', category.id)
      .where('locale', 'fr')
      .firstOrFail()
    assert.equal(fr.name, 'Vêtements')
  })

  test('le slug doit être unique', async ({ client, assert }) => {
    const owner = await makeMember('dup@example.com', 'dup-org', 'owner')

    const response = await client
      .post('/fr/admin/categories')
      .redirects(0)
      .withCsrfToken()
      .loginAs(owner)
      .json({ slug: 'crayon', parentId: null, translations: CONTENT })

    // 'crayon' existe déjà (CategorySeeder) → échec de validation VineJS :
    // redirection arrière (302) avec les erreurs flashées, aucune création.
    response.assertStatus(302)
    const crayons = await Category.query().where('slug', 'crayon')
    assert.lengthOf(crayons, 1)
  })

  test('mise à jour du nom et du parent', async ({ client, assert }) => {
    const owner = await makeMember('editor@example.com', 'editor-org', 'owner')
    const stylo = await Category.findByOrFail('slug', 'stylo')
    const crayon = await Category.findByOrFail('slug', 'crayon')

    const response = await client
      .patch(`/fr/admin/categories/${stylo.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)
      .json({
        parentId: crayon.id,
        synonyms: [],
        translations: {
          fr: { name: 'Stylo bille', description: null },
          en: { name: 'Ballpoint', description: null },
        },
      })

    response.assertStatus(200)

    await stylo.refresh()
    assert.equal(stylo.parentId, crayon.id)

    const fr = await CategoryTranslation.query()
      .where('categoryId', stylo.id)
      .where('locale', 'fr')
      .firstOrFail()
    assert.equal(fr.name, 'Stylo bille')
  })

  test('la suppression d’une catégorie feuille réussit', async ({ client, assert }) => {
    const owner = await makeMember('remover@example.com', 'remover-org', 'owner')
    const sac = await Category.findByOrFail('slug', 'sac')

    const response = await client
      .delete(`/fr/admin/categories/${sac.id}`)
      .redirects(0)
      .withCsrfToken()
      .loginAs(owner)

    response.assertStatus(302)
    assert.isNull(await Category.find(sac.id))
  })

  test('la suppression est bloquée si la catégorie a des sous-catégories', async ({
    client,
    assert,
  }) => {
    const owner = await makeMember('parent@example.com', 'parent-org', 'owner')
    const crayon = await Category.findByOrFail('slug', 'crayon')
    const child = await Category.create({
      slug: 'crayon-couleur',
      parentId: crayon.id,
      synonyms: [],
    })

    const response = await client
      .delete(`/fr/admin/categories/${crayon.id}`)
      .redirects(0)
      .withCsrfToken()
      .loginAs(owner)

    response.assertStatus(302)
    // Non supprimée : le parent et l'enfant existent toujours.
    assert.isNotNull(await Category.find(crayon.id))
    assert.isNotNull(await Category.find(child.id))
  })

  test('un cycle de parenté est refusé à la mise à jour', async ({ client, assert }) => {
    const owner = await makeMember('cycle@example.com', 'cycle-org', 'owner')
    const crayon = await Category.findByOrFail('slug', 'crayon')
    const child = await Category.create({ slug: 'crayon-hb', parentId: crayon.id, synonyms: [] })

    // Tenter de faire de `crayon` un enfant de son propre descendant `child`.
    const response = await client
      .patch(`/fr/admin/categories/${crayon.id}`)
      .redirects(0)
      .withCsrfToken()
      .loginAs(owner)
      .json({
        parentId: child.id,
        synonyms: [],
        translations: {
          fr: { name: 'Crayon', description: null },
          en: { name: 'Pencil', description: null },
        },
      })

    response.assertStatus(302)
    await crayon.refresh()
    assert.isNull(crayon.parentId)
  })
})
