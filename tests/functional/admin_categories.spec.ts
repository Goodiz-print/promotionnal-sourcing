import { test } from '@japa/runner'
import CategorySeeder from '#database/seeders/category_seeder'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import type User from '#models/user'
import Category from '#models/category'
import AdminAuditLog from '#models/admin_audit_log'
import { CategoryFactory } from '#database/factories/category_factory'
import CategoryTranslation from '#models/category_translation'
import { createMember, joinOrganization } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'
import type { RoleSlug } from '#shared/types/role'

/**
 * Membre d'une organisation acheteuse fraîche, qui devient son organisation
 * courante : sert à prouver que le rôle d'organisation n'ouvre pas la taxonomie.
 */
function freshOrgMember(roleSlug: RoleSlug = 'owner'): Promise<User> {
  return OrganizationFactory.create().then((organization) => createMember(organization, roleSlug))
}

/**
 * Admin plateforme **sans** organisation : la taxonomie est globale, elle ne
 * dépend d'aucune adhésion.
 */
function platformAdmin(): Promise<User> {
  return UserFactory.apply('platformAdmin').create()
}

const CONTENT = {
  fr: { name: 'Vêtements', description: 'Textile publicitaire' },
  en: { name: 'Apparel', description: 'Promotional textile' },
}

test.group('Administration des catégories — CRUD + ACL', (group) => {
  useDatabase(group, { extraSeeders: [CategorySeeder] })

  test('un admin plateforme voit la liste des catégories', async ({ client }) => {
    const admin = await platformAdmin()

    const response = await client.get('/fr/admin/categories').withInertia().loginAs(admin)

    response.assertStatus(200)
    response.assertInertiaComponent('admin/categories/index')
  })

  test('un admin plateforme membre d’une organisation y accède aussi', async ({ client }) => {
    const organization = await OrganizationFactory.create()
    const admin = await UserFactory.apply('platformAdmin').create()
    await joinOrganization(admin, organization, 'member')

    const response = await client.get('/fr/admin/categories').withInertia().loginAs(admin)

    response.assertStatus(200)
  })

  for (const roleSlug of ['owner', 'admin', 'manager', 'member'] as const) {
    test(`un ${roleSlug} d’organisation ordinaire ne peut pas gérer les catégories (403)`, async ({
      client,
      assert,
    }) => {
      const user = await freshOrgMember(roleSlug)
      const sac = await Category.findByOrFail('slug', 'sac')

      const list = await client.get('/fr/admin/categories').withInertia().loginAs(user)
      const create = await client.get('/fr/admin/categories/new').withInertia().loginAs(user)
      assert.equal(list.status(), 403)
      assert.equal(create.status(), 403)

      // Écritures : refusées sans suivre la redirection de retour du formulaire
      // (le 403 devient un flash), et surtout **sans effet** en base.
      const store = await client
        .post('/fr/admin/categories')
        .redirects(0)
        .withCsrfToken()
        .loginAs(user)
        .json({ slug: 'intrus', parentId: null, sourceLocale: 'fr', translations: CONTENT })
      const destroy = await client
        .delete(`/fr/admin/categories/${sac.id}`)
        .redirects(0)
        .withCsrfToken()
        .loginAs(user)
      assert.isAtLeast(store.status(), 302)
      assert.isAtLeast(destroy.status(), 302)
      assert.isNull(await Category.findBy('slug', 'intrus'))
      assert.isNotNull(await Category.find(sac.id))
    })
  }

  test('un utilisateur sans organisation ni rôle plateforme reçoit un 403', async ({ client }) => {
    const user = await UserFactory.create()

    const response = await client.get('/fr/admin/categories').redirects(0).loginAs(user)

    response.assertStatus(403)
  })

  test('un visiteur anonyme est renvoyé vers la connexion', async ({ client }) => {
    const response = await client.get('/fr/admin/categories').redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/login')
  })

  test('création d’une catégorie avec ses traductions', async ({ client, assert }) => {
    const admin = await platformAdmin()

    const response = await client
      .post('/fr/admin/categories')
      .withInertia()
      .withCsrfToken()
      .loginAs(admin)
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
    const admin = await platformAdmin()

    const response = await client
      .post('/fr/admin/categories')
      .redirects(0)
      .withCsrfToken()
      .loginAs(admin)
      .json({ slug: 'crayon', parentId: null, sourceLocale: 'fr', translations: CONTENT })

    // 'crayon' existe déjà (CategorySeeder) → échec de validation VineJS :
    // redirection arrière (302) avec les erreurs flashées, aucune création.
    response.assertStatus(302)
    const crayons = await Category.query().where('slug', 'crayon')
    assert.lengthOf(crayons, 1)
  })

  test('mise à jour du nom et du parent', async ({ client, assert }) => {
    const admin = await platformAdmin()
    const stylo = await Category.findByOrFail('slug', 'stylo')
    const crayon = await Category.findByOrFail('slug', 'crayon')

    const response = await client
      .patch(`/fr/admin/categories/${stylo.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(admin)
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
    const admin = await platformAdmin()
    const sac = await Category.findByOrFail('slug', 'sac')

    const response = await client
      .delete(`/fr/admin/categories/${sac.id}`)
      .redirects(0)
      .withCsrfToken()
      .loginAs(admin)

    response.assertStatus(302)
    assert.isNull(await Category.find(sac.id))
  })

  test('la suppression est bloquée si la catégorie a des sous-catégories', async ({
    client,
    assert,
  }) => {
    const admin = await platformAdmin()
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
      .loginAs(admin)

    response.assertStatus(302)
    // Non supprimée : le parent et l'enfant existent toujours.
    assert.isNotNull(await Category.find(crayon.id))
    assert.isNotNull(await Category.find(child.id))
  })

  test('un cycle de parenté est refusé à la mise à jour', async ({ client, assert }) => {
    const admin = await platformAdmin()
    const crayon = await Category.findByOrFail('slug', 'crayon')
    const child = await Category.create({ slug: 'crayon-hb', parentId: crayon.id, synonyms: [] })

    // Tenter de faire de `crayon` un enfant de son propre descendant `child`.
    const response = await client
      .patch(`/fr/admin/categories/${crayon.id}`)
      .redirects(0)
      .withCsrfToken()
      .loginAs(admin)
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

test.group('Administration des categories - Attributs associes', (group) => {
  useDatabase(group, { seed: 'full' })

  test("la page d'edition expose categoryAttributes et availableAttributes", async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const category = await Category.firstOrFail()

    const response = await client
      .get(`/fr/admin/categories/${category.id}/edit`)
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    response.assertInertiaComponent('admin/categories/edit')

    const props = response.inertiaProps!
    assert.isArray(props.categoryAttributes)
    assert.isArray(props.availableAttributes)

    // Tous les attributs associes ont les champs requis
    for (const attr of props.categoryAttributes) {
      assert.property(attr, 'id')
      assert.property(attr, 'attributeId')
      assert.property(attr, 'slug')
      assert.property(attr, 'isFilter')
      assert.property(attr, 'ranges')
    }

    // Tous les attributs disponibles ont les champs requis
    for (const option of props.availableAttributes) {
      assert.property(option, 'id')
      assert.property(option, 'slug')
      assert.property(option, 'name')
    }

    // Un attribut associe n'est plus dans availableAttributes
    const associatedIds = props.categoryAttributes.map(
      (a: { attributeId: number }) => a.attributeId
    )
    const availableIds = props.availableAttributes.map((a: { id: number }) => a.id)
    for (const id of associatedIds) {
      assert.notInclude(
        availableIds,
        id,
        'Un attribut associe ne doit pas etre dans availableAttributes'
      )
    }
  })
})

test.group('Administration des catégories — réordonnancement', (group) => {
  useDatabase(group)

  /** Crée trois catégories racines A, B, C aux positions 0, 1, 2. */
  async function threeRoots() {
    const a = await CategoryFactory.merge({ slug: 'ordre-a', position: 0 }).create()
    const b = await CategoryFactory.merge({ slug: 'ordre-b', position: 1 }).create()
    const c = await CategoryFactory.merge({ slug: 'ordre-c', position: 2 }).create()
    return { a, b, c }
  }

  test('descendre une catégorie échange sa position avec sa sœur et écrit un audit', async ({
    client,
    assert,
  }) => {
    const admin = await platformAdmin()
    const { a, b } = await threeRoots()

    const response = await client
      .patch(`/fr/admin/categories/${a.id}/move`)
      .json({ direction: 'down' })
      .withCsrfToken()
      .loginAs(admin)
      .redirects(0)

    response.assertStatus(302)
    await a.refresh()
    await b.refresh()
    assert.equal(a.position, 1)
    assert.equal(b.position, 0)
    const audit = await AdminAuditLog.query().where('action', 'category.reordered')
    assert.lengthOf(audit, 1)
    assert.equal(audit[0].targetId, a.id)
  })

  test('monter la première catégorie est sans effet (aucun audit)', async ({ client, assert }) => {
    const admin = await platformAdmin()
    const { a } = await threeRoots()

    const response = await client
      .patch(`/fr/admin/categories/${a.id}/move`)
      .json({ direction: 'up' })
      .withCsrfToken()
      .loginAs(admin)
      .redirects(0)

    response.assertStatus(302)
    await a.refresh()
    assert.equal(a.position, 0)
    const audit = await AdminAuditLog.query().where('action', 'category.reordered')
    assert.lengthOf(audit, 0)
  })

  test('une direction invalide est refusée', async ({ client, assert }) => {
    const admin = await platformAdmin()
    const { a } = await threeRoots()

    const response = await client
      .patch(`/fr/admin/categories/${a.id}/move`)
      .json({ direction: 'sideways' })
      .withCsrfToken()
      .loginAs(admin)
      .redirects(0)

    response.assertStatus(302)
    await a.refresh()
    assert.equal(a.position, 0)
  })

  test('le déplacement ne touche que les sœurs du même parent', async ({ client, assert }) => {
    const admin = await platformAdmin()
    const { a, b } = await threeRoots()
    const child = await CategoryFactory.merge({
      slug: 'ordre-enfant',
      parentId: a.id,
      position: 0,
    }).create()

    const response = await client
      .patch(`/fr/admin/categories/${child.id}/move`)
      .json({ direction: 'down' })
      .withCsrfToken()
      .loginAs(admin)
      .redirects(0)

    response.assertStatus(302)
    await a.refresh()
    await b.refresh()
    assert.equal(a.position, 0)
    assert.equal(b.position, 1)
  })

  test('les positions en doublon sont renumérotées', async ({ client, assert }) => {
    const admin = await platformAdmin()
    const x = await CategoryFactory.merge({ slug: 'dup-x', position: 0 }).create()
    const y = await CategoryFactory.merge({ slug: 'dup-y', position: 0 }).create()

    await client
      .patch(`/fr/admin/categories/${x.id}/move`)
      .json({ direction: 'down' })
      .withCsrfToken()
      .loginAs(admin)
      .redirects(0)

    await x.refresh()
    await y.refresh()
    assert.equal(y.position, 0)
    assert.equal(x.position, 1)
  })

  test('une catégorie créée est placée en fin de liste de ses sœurs', async ({
    client,
    assert,
  }) => {
    const admin = await platformAdmin()
    await threeRoots()

    await client
      .post('/fr/admin/categories')
      .json({ slug: 'ordre-d', sourceLocale: 'fr', translations: { fr: { name: 'Quatrième' } } })
      .withCsrfToken()
      .loginAs(admin)
      .redirects(0)

    const created = await Category.findByOrFail('slug', 'ordre-d')
    assert.equal(created.position, 3)
  })

  test('la liste d’administration suit l’ordre de l’arbre avec profondeur et déplacements possibles', async ({
    client,
    assert,
  }) => {
    const admin = await platformAdmin()
    const { a } = await threeRoots()
    await CategoryFactory.merge({ slug: 'ordre-a-fils', parentId: a.id, position: 0 }).create()

    const response = await client.get('/fr/admin/categories').withInertia().loginAs(admin)

    const list = response.inertiaProps.categories as Array<{
      slug: string
      depth: number
      canMoveUp: boolean
      canMoveDown: boolean
    }>
    assert.deepEqual(
      list.map((c) => c.slug),
      ['ordre-a', 'ordre-a-fils', 'ordre-b', 'ordre-c']
    )
    assert.deepEqual(
      list.map((c) => c.depth),
      [0, 1, 0, 0]
    )
    assert.isFalse(list[0].canMoveUp)
    assert.isTrue(list[0].canMoveDown)
    assert.isFalse(list[1].canMoveUp)
    assert.isFalse(list[1].canMoveDown)
    assert.isFalse(list[3].canMoveDown)
  })

  test('un déplacement réel annonce un succès, un no-op n’en annonce pas', async ({
    client,
    assert,
  }) => {
    const admin = await platformAdmin()
    const { a } = await threeRoots()

    const moved = await client
      .patch(`/fr/admin/categories/${a.id}/move`)
      .json({ direction: 'down' })
      .withCsrfToken()
      .loginAs(admin)
      .redirects(0)
    assert.isString(moved.flashMessages().success)

    // `ordre-b` est maintenant la première : la monter est un no-op.
    const first = await Category.findByOrFail('slug', 'ordre-b')
    const noop = await client
      .patch(`/fr/admin/categories/${first.id}/move`)
      .json({ direction: 'up' })
      .withCsrfToken()
      .loginAs(admin)
      .redirects(0)
    assert.isUndefined(noop.flashMessages().success)
  })

  test('changer le parent place la catégorie en fin de liste de ses nouvelles sœurs', async ({
    client,
    assert,
  }) => {
    const admin = await platformAdmin()
    const { a, b } = await threeRoots()
    const existing = await CategoryFactory.merge({
      slug: 'ordre-b-fils',
      parentId: b.id,
      position: 0,
    }).create()

    await client
      .patch(`/fr/admin/categories/${a.id}`)
      .json({ parentId: b.id, translations: { fr: { name: 'Catégorie A' } } })
      .withCsrfToken()
      .loginAs(admin)
      .redirects(0)

    await a.refresh()
    await existing.refresh()
    assert.equal(a.parentId, b.id)
    assert.equal(a.position, 1)
    assert.equal(existing.position, 0)
  })

  test('un utilisateur non plateforme ne peut pas déplacer (sans effet)', async ({
    client,
    assert,
  }) => {
    const user = await freshOrgMember('owner')
    const { a } = await threeRoots()

    // Refus sans suivre la redirection de retour (le 403 devient un flash).
    const response = await client
      .patch(`/fr/admin/categories/${a.id}/move`)
      .json({ direction: 'down' })
      .withCsrfToken()
      .loginAs(user)
      .redirects(0)

    assert.isAtLeast(response.status(), 302)
    await a.refresh()
    assert.equal(a.position, 0)
    assert.lengthOf(await AdminAuditLog.query().where('action', 'category.reordered'), 0)
  })
})
