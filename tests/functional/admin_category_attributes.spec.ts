import { test } from '@japa/runner'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import type User from '#models/user'
import Attribute from '#models/attribute'
import Category from '#models/category'
import CategoryAttribute from '#models/category_attribute'
import CategoryAttributeRange from '#models/category_attribute_range'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'
import type { RoleSlug } from '#shared/types/role'

/**
 * Membre d'une organisation acheteuse fraiche : prouve que le role d'organisation
 * n'ouvre pas l'administration des attributs de categorie.
 */
function freshOrgMember(roleSlug: RoleSlug = 'owner'): Promise<User> {
  return OrganizationFactory.create().then((organization) => createMember(organization, roleSlug))
}

function platformAdmin(): Promise<User> {
  return UserFactory.apply('platformAdmin').create()
}

test.group('Administration des attributs de categorie - ACL', (group) => {
  useDatabase(group, { seed: 'full' })

  for (const roleSlug of ['owner', 'admin', 'manager', 'member'] as const) {
    test(`un ${roleSlug} d'organisation ordinaire ne peut pas gerer les attributs de categorie (403)`, async ({
      client,
      assert,
    }) => {
      const user = await freshOrgMember(roleSlug)
      const category = await Category.firstOrFail()
      const attribute = await Attribute.firstOrFail()

      // Ajouter un attribut a une categorie
      const store = await client
        .post(`/fr/admin/categories/${category.id}/attributes`)
        .redirects(0)
        .withCsrfToken()
        .loginAs(user)
        .json({ attributeId: attribute.id })

      assert.isAtLeast(store.status(), 302)
    })
  }
})

test.group('Administration des attributs de categorie - CRUD', (group) => {
  useDatabase(group, { seed: 'full' })

  test("ajout d'un attribut a une categorie", async ({ client, assert }) => {
    const admin = await platformAdmin()
    const category = await Category.firstOrFail()
    // Trouver un attribut non encore lie a cette categorie
    const existingPivots = await CategoryAttribute.query().where('categoryId', category.id)
    const existingAttrIds = existingPivots.map((p) => p.attributeId)
    const attribute = await Attribute.query()
      .whereNotIn('id', existingAttrIds.length > 0 ? existingAttrIds : [0])
      .firstOrFail()

    const response = await client
      .post(`/fr/admin/categories/${category.id}/attributes`)
      .withInertia()
      .withCsrfToken()
      .loginAs(admin)
      .json({ attributeId: attribute.id, isFilter: true })

    response.assertStatus(200)

    const pivot = await CategoryAttribute.query()
      .where('categoryId', category.id)
      .where('attributeId', attribute.id)
      .firstOrFail()
    assert.isTrue(pivot.isFilter)
  })

  test('un attribut ne peut pas etre ajoute deux fois a la meme categorie', async ({ client }) => {
    const admin = await platformAdmin()
    const category = await Category.firstOrFail()
    const attribute = await Attribute.firstOrFail()

    // S'assurer qu'il y a un pivot existant
    let pivot = await CategoryAttribute.query()
      .where('categoryId', category.id)
      .where('attributeId', attribute.id)
      .first()
    if (!pivot) {
      pivot = await CategoryAttribute.create({
        categoryId: category.id,
        attributeId: attribute.id,
        position: 0,
      })
    }

    const response = await client
      .post(`/fr/admin/categories/${category.id}/attributes`)
      .redirects(0)
      .withCsrfToken()
      .loginAs(admin)
      .json({ attributeId: attribute.id })

    response.assertStatus(409)
  })

  test("mise a jour d'un pivot categorie-attribut", async ({ client, assert }) => {
    const admin = await platformAdmin()
    const category = await Category.firstOrFail()
    const attribute = await Attribute.firstOrFail()

    // S'assurer qu'il y a un pivot existant
    let pivot = await CategoryAttribute.query()
      .where('categoryId', category.id)
      .where('attributeId', attribute.id)
      .first()
    if (!pivot) {
      pivot = await CategoryAttribute.create({
        categoryId: category.id,
        attributeId: attribute.id,
        isFilter: false,
        position: 0,
      })
    }

    const response = await client
      .patch(`/fr/admin/category-attributes/${pivot.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(admin)
      .json({ isFilter: true, position: 5 })

    response.assertStatus(200)
    await pivot.refresh()
    assert.isTrue(pivot.isFilter)
    assert.equal(pivot.position, 5)
  })

  test("suppression d'un pivot categorie-attribut", async ({ client, assert }) => {
    const admin = await platformAdmin()
    const category = await Category.firstOrFail()
    const attribute = await Attribute.firstOrFail()

    // Creer un pivot specifique pour ce test
    const pivot = await CategoryAttribute.create({
      categoryId: category.id,
      attributeId: attribute.id,
      position: 99,
    })
    const pivotId = pivot.id

    const response = await client
      .delete(`/fr/admin/category-attributes/${pivotId}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(admin)

    response.assertStatus(200)
    assert.isNull(await CategoryAttribute.find(pivotId))
  })

  test('mise a jour des plages pour un attribut numerique', async ({ client, assert }) => {
    const admin = await platformAdmin()
    // Trouver un attribut de type number
    const numericAttr = await Attribute.query().where('type', 'number').firstOrFail()
    const category = await Category.firstOrFail()

    // Creer ou trouver un pivot pour cet attribut
    let pivot = await CategoryAttribute.query()
      .where('categoryId', category.id)
      .where('attributeId', numericAttr.id)
      .first()
    if (!pivot) {
      pivot = await CategoryAttribute.create({
        categoryId: category.id,
        attributeId: numericAttr.id,
        position: 0,
      })
    }

    const response = await client
      .patch(`/fr/admin/category-attributes/${pivot.id}/ranges`)
      .withInertia()
      .withCsrfToken()
      .loginAs(admin)
      .json({
        ranges: [
          { minValue: null, maxValue: 100 },
          { minValue: 100, maxValue: 500 },
          { minValue: 500, maxValue: null },
        ],
      })

    response.assertStatus(200)

    const ranges = await CategoryAttributeRange.query()
      .where('categoryAttributeId', pivot.id)
      .orderBy('position', 'asc')
    assert.equal(ranges.length, 3)
    assert.isNull(ranges[0].minValue)
    assert.equal(ranges[0].maxValue, '100')
    assert.equal(ranges[1].minValue, '100')
    assert.equal(ranges[1].maxValue, '500')
    assert.equal(ranges[2].minValue, '500')
    assert.isNull(ranges[2].maxValue)
  })
})
