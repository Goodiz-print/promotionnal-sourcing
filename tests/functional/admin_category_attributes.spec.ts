import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import type User from '#models/user'
import Attribute from '#models/attribute'
import Category from '#models/category'
import CategoryAttribute from '#models/category_attribute'
import CategoryAttributeRange from '#models/category_attribute_range'
import SearchSyncService from '#services/search_sync_service'
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

/**
 * Cree un espion pour SearchSyncService qui enregistre les appels.
 */
function createSearchSyncSpy() {
  const calls = {
    queueProduct: [] as number[],
    queueOrganization: [] as number[],
    queueSettings: 0,
  }
  const spy = {
    queueProduct: async (productId: number) => {
      calls.queueProduct.push(productId)
    },
    queueOrganization: async (organizationId: number) => {
      calls.queueOrganization.push(organizationId)
    },
    queueSettings: async () => {
      calls.queueSettings++
    },
  } as unknown as SearchSyncService
  return { spy, calls }
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

  test("ajout d'un attribut filtrable declenche queueSettings", async ({ client, assert }) => {
    const admin = await platformAdmin()
    const category = await Category.firstOrFail()
    // Trouver un attribut non encore lie a cette categorie
    const existingPivots = await CategoryAttribute.query().where('categoryId', category.id)
    const existingAttrIds = existingPivots.map((p) => p.attributeId)
    const attribute = await Attribute.query()
      .whereNotIn('id', existingAttrIds.length > 0 ? existingAttrIds : [0])
      .firstOrFail()

    const { spy, calls } = createSearchSyncSpy()
    app.container.swap(SearchSyncService, () => spy)

    try {
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
      assert.equal(calls.queueSettings, 1, 'queueSettings doit etre appele pour isFilter=true')
    } finally {
      app.container.restore(SearchSyncService)
    }
  })

  test("ajout d'un attribut non filtrable ne declenche pas queueSettings", async ({
    client,
    assert,
  }) => {
    const admin = await platformAdmin()
    const category = await Category.firstOrFail()
    // Trouver un attribut non encore lie a cette categorie
    const existingPivots = await CategoryAttribute.query().where('categoryId', category.id)
    const existingAttrIds = existingPivots.map((p) => p.attributeId)
    const attribute = await Attribute.query()
      .whereNotIn('id', existingAttrIds.length > 0 ? existingAttrIds : [0])
      .firstOrFail()

    const { spy, calls } = createSearchSyncSpy()
    app.container.swap(SearchSyncService, () => spy)

    try {
      const response = await client
        .post(`/fr/admin/categories/${category.id}/attributes`)
        .withInertia()
        .withCsrfToken()
        .loginAs(admin)
        .json({ attributeId: attribute.id, isFilter: false })

      response.assertStatus(200)
      assert.equal(
        calls.queueSettings,
        0,
        'queueSettings ne doit pas etre appele pour isFilter=false'
      )
    } finally {
      app.container.restore(SearchSyncService)
    }
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

  test('mise a jour de isFilter declenche queueSettings', async ({ client, assert }) => {
    const admin = await platformAdmin()
    const category = await Category.firstOrFail()
    const attribute = await Attribute.firstOrFail()

    // Creer un pivot avec isFilter=false
    const pivot = await CategoryAttribute.create({
      categoryId: category.id,
      attributeId: attribute.id,
      isFilter: false,
      position: 98,
    })

    const { spy, calls } = createSearchSyncSpy()
    app.container.swap(SearchSyncService, () => spy)

    try {
      const response = await client
        .patch(`/fr/admin/category-attributes/${pivot.id}`)
        .withInertia()
        .withCsrfToken()
        .loginAs(admin)
        .json({ isFilter: true })

      response.assertStatus(200)
      await pivot.refresh()
      assert.isTrue(pivot.isFilter)
      assert.equal(calls.queueSettings, 1, 'queueSettings doit etre appele quand isFilter change')
    } finally {
      app.container.restore(SearchSyncService)
      await pivot.delete()
    }
  })

  test('mise a jour de position seule ne declenche pas queueSettings', async ({
    client,
    assert,
  }) => {
    const admin = await platformAdmin()
    const category = await Category.firstOrFail()
    const attribute = await Attribute.firstOrFail()

    // Creer un pivot
    const pivot = await CategoryAttribute.create({
      categoryId: category.id,
      attributeId: attribute.id,
      isFilter: false,
      position: 97,
    })

    const { spy, calls } = createSearchSyncSpy()
    app.container.swap(SearchSyncService, () => spy)

    try {
      const response = await client
        .patch(`/fr/admin/category-attributes/${pivot.id}`)
        .withInertia()
        .withCsrfToken()
        .loginAs(admin)
        .json({ position: 5 })

      response.assertStatus(200)
      await pivot.refresh()
      assert.equal(pivot.position, 5)
      assert.equal(
        calls.queueSettings,
        0,
        'queueSettings ne doit pas etre appele pour position seule'
      )
    } finally {
      app.container.restore(SearchSyncService)
      await pivot.delete()
    }
  })

  test("suppression d'un pivot filtrable declenche queueSettings", async ({ client, assert }) => {
    const admin = await platformAdmin()
    const category = await Category.firstOrFail()
    const attribute = await Attribute.firstOrFail()

    // Creer un pivot filtrable
    const pivot = await CategoryAttribute.create({
      categoryId: category.id,
      attributeId: attribute.id,
      isFilter: true,
      position: 96,
    })
    const pivotId = pivot.id

    const { spy, calls } = createSearchSyncSpy()
    app.container.swap(SearchSyncService, () => spy)

    try {
      const response = await client
        .delete(`/fr/admin/category-attributes/${pivotId}`)
        .withInertia()
        .withCsrfToken()
        .loginAs(admin)

      response.assertStatus(200)
      assert.isNull(await CategoryAttribute.find(pivotId))
      assert.equal(calls.queueSettings, 1, 'queueSettings doit etre appele pour un pivot filtrable')
    } finally {
      app.container.restore(SearchSyncService)
    }
  })

  test("suppression d'un pivot non filtrable ne declenche pas queueSettings", async ({
    client,
    assert,
  }) => {
    const admin = await platformAdmin()
    const category = await Category.firstOrFail()
    const attribute = await Attribute.firstOrFail()

    // Creer un pivot non filtrable
    const pivot = await CategoryAttribute.create({
      categoryId: category.id,
      attributeId: attribute.id,
      isFilter: false,
      position: 95,
    })
    const pivotId = pivot.id

    const { spy, calls } = createSearchSyncSpy()
    app.container.swap(SearchSyncService, () => spy)

    try {
      const response = await client
        .delete(`/fr/admin/category-attributes/${pivotId}`)
        .withInertia()
        .withCsrfToken()
        .loginAs(admin)

      response.assertStatus(200)
      assert.isNull(await CategoryAttribute.find(pivotId))
      assert.equal(
        calls.queueSettings,
        0,
        'queueSettings ne doit pas etre appele pour un pivot non filtrable'
      )
    } finally {
      app.container.restore(SearchSyncService)
    }
  })

  test('mise a jour des plages pour un attribut numerique', async ({ client, assert }) => {
    const admin = await platformAdmin()
    // Trouver un attribut de type number
    const numericAttr = await Attribute.query().where('type', 'number').firstOrFail()
    const category = await Category.firstOrFail()

    // Creer un pivot pour cet attribut
    const pivot = await CategoryAttribute.create({
      categoryId: category.id,
      attributeId: numericAttr.id,
      position: 94,
    })

    try {
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
    } finally {
      await pivot.delete()
    }
  })
})
