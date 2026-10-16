import { test } from '@japa/runner'
import CategorySeeder from '#database/seeders/category_seeder'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import type User from '#models/user'
import Category from '#models/category'
import CategoryTranslation from '#models/category_translation'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'
import type { RoleSlug } from '#shared/types/role'

/**
 * Membre d'une organisation acheteuse fraîche, qui devient son organisation
 * courante. Les catégories sont une ressource globale : l'organisation ne sert
 * qu'à porter le rôle testé.
 */
function freshOrgMember(roleSlug: RoleSlug = 'owner'): Promise<User> {
  return OrganizationFactory.create().then((organization) => createMember(organization, roleSlug))
}

const CONTENT = {
  fr: { name: 'Vêtements', description: 'Textile publicitaire' },
  en: { name: 'Apparel', description: 'Promotional textile' },
}

test.group('Administration des catégories — CRUD + ACL', (group) => {
  useDatabase(group, { extraSeeders: [CategorySeeder] })

  test("l'owner voit la liste des catégories", async ({ client }) => {
    const owner = await freshOrgMember()

    const response = await client.get('/fr/admin/categories').withInertia().loginAs(owner)

    response.assertStatus(200)
    response.assertInertiaComponent('admin/categories/index')
  })

  test('un membre ne peut pas gérer les catégories (403)', async ({ client }) => {
    const member = await freshOrgMember('member')

    const response = await client.get('/fr/admin/categories').withInertia().loginAs(member)

    response.assertStatus(403)
  })

  test('un utilisateur sans organisation est renvoyé vers l’onboarding', async ({ client }) => {
    const user = await UserFactory.create()

    const response = await client.get('/fr/admin/categories').redirects(0).loginAs(user)

    response.assertStatus(302)
    response.assertHeader('location', '/fr/onboarding')
  })

  test('création d’une catégorie avec ses traductions', async ({ client, assert }) => {
    const owner = await freshOrgMember()

    const response = await client
      .post('/fr/admin/categories')
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)
      .json({
        slug: 'vetements',
        parentId: null,
        synonyms: ['tshirt', 'textile'],
        sourceLocale: 'fr',
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
    const owner = await freshOrgMember()

    const response = await client
      .post('/fr/admin/categories')
      .redirects(0)
      .withCsrfToken()
      .loginAs(owner)
      .json({ slug: 'crayon', parentId: null, sourceLocale: 'fr', translations: CONTENT })

    // 'crayon' existe déjà (CategorySeeder) → échec de validation VineJS :
    // redirection arrière (302) avec les erreurs flashées, aucune création.
    response.assertStatus(302)
    const crayons = await Category.query().where('slug', 'crayon')
    assert.lengthOf(crayons, 1)
  })

  test('mise à jour du nom et du parent', async ({ client, assert }) => {
    const owner = await freshOrgMember()
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
    const owner = await freshOrgMember()
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
    const owner = await freshOrgMember()
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
    const owner = await freshOrgMember()
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
