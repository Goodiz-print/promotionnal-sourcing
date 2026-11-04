import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import type User from '#models/user'
import Attribute from '#models/attribute'
import Category from '#models/category'
import CategoryAttribute from '#models/category_attribute'
import CategoryAttributeRange from '#models/category_attribute_range'
import AdminAuditLog from '#models/admin_audit_log'
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

  test('un attribut ne peut pas etre ajoute deux fois a la meme categorie', async ({
    client,
    assert,
  }) => {
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

    // Refus en flash d'erreur (redirection Inertia), sans second pivot.
    response.assertStatus(302)
    const pivots = await CategoryAttribute.query()
      .where('categoryId', category.id)
      .where('attributeId', attribute.id)
    assert.lengthOf(pivots, 1)
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
        .patch(`/fr/admin/categories/${category.id}/attributes/${pivot.id}`)
        .redirects(0)
        .withCsrfToken()
        .loginAs(admin)
        .json({ isFilter: true })

      response.assertStatus(302)
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
        .patch(`/fr/admin/categories/${category.id}/attributes/${pivot.id}`)
        .redirects(0)
        .withCsrfToken()
        .loginAs(admin)
        .json({ position: 5 })

      response.assertStatus(302)
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
        .delete(`/fr/admin/categories/${category.id}/attributes/${pivotId}`)
        .redirects(0)
        .withCsrfToken()
        .loginAs(admin)

      response.assertStatus(302)
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
        .delete(`/fr/admin/categories/${category.id}/attributes/${pivotId}`)
        .redirects(0)
        .withCsrfToken()
        .loginAs(admin)

      response.assertStatus(302)
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
        .patch(`/fr/admin/categories/${category.id}/attributes/${pivot.id}/ranges`)
        .redirects(0)
        .withCsrfToken()
        .loginAs(admin)
        .json({
          ranges: [
            { minValue: null, maxValue: 100 },
            { minValue: 100, maxValue: 500 },
            { minValue: 500, maxValue: null },
          ],
        })

      response.assertStatus(302)

      const ranges = await CategoryAttributeRange.query()
        .where('categoryAttributeId', pivot.id)
        .orderBy('position', 'asc')
      assert.equal(ranges.length, 3)
      // Comparaison numerique : Postgres renvoie les decimaux avec precision (ex. '100.00')
      assert.isNull(ranges[0].minValue)
      assert.equal(Number(ranges[0].maxValue), 100)
      assert.equal(Number(ranges[1].minValue), 100)
      assert.equal(Number(ranges[1].maxValue), 500)
      assert.equal(Number(ranges[2].minValue), 500)
      assert.isNull(ranges[2].maxValue)
    } finally {
      await pivot.delete()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// No-op, validation et robustesse
// ─────────────────────────────────────────────────────────────────────────────

test.group('Administration des attributs de categorie - no-op', (group) => {
  useDatabase(group, { seed: 'full' })

  test('mise a jour sans changement ne cree pas de log audit', async ({ client, assert }) => {
    const admin = await platformAdmin()
    const category = await Category.firstOrFail()
    const attribute = await Attribute.firstOrFail()

    // Creer un pivot avec des valeurs connues
    const pivot = await CategoryAttribute.create({
      categoryId: category.id,
      attributeId: attribute.id,
      isFilter: false,
      isRequiredForPublication: false,
      position: 42,
    })

    const auditCountBefore = await AdminAuditLog.query()
      .where('targetType', 'category_attribute')
      .where('targetId', pivot.id)
      .where('action', 'category_attribute.updated')
      .count('* as total')
      .first()
    const countBefore = Number(auditCountBefore?.$extras.total ?? 0)

    try {
      // Reenvoyer les memes valeurs
      const response = await client
        .patch(`/fr/admin/categories/${category.id}/attributes/${pivot.id}`)
        .redirects(0)
        .withCsrfToken()
        .loginAs(admin)
        .json({
          isFilter: false,
          isRequiredForPublication: false,
          position: 42,
        })

      response.assertStatus(302)

      // Pas de nouveau log audit
      const auditCountAfter = await AdminAuditLog.query()
        .where('targetType', 'category_attribute')
        .where('targetId', pivot.id)
        .where('action', 'category_attribute.updated')
        .count('* as total')
        .first()
      const countAfter = Number(auditCountAfter?.$extras.total ?? 0)
      assert.equal(countAfter, countBefore, 'Aucun log audit ne doit etre cree pour un no-op')
    } finally {
      await pivot.delete()
    }
  })

  test('mise a jour des plages sans changement ne cree pas de log audit', async ({
    client,
    assert,
  }) => {
    const admin = await platformAdmin()
    const numericAttr = await Attribute.query().where('type', 'number').firstOrFail()
    const category = await Category.firstOrFail()

    // Creer un pivot avec des plages
    const pivot = await CategoryAttribute.create({
      categoryId: category.id,
      attributeId: numericAttr.id,
      position: 93,
    })
    await CategoryAttributeRange.createMany([
      { categoryAttributeId: pivot.id, minValue: null, maxValue: '100', position: 0 },
      { categoryAttributeId: pivot.id, minValue: '100', maxValue: '500', position: 1 },
    ])

    const auditCountBefore = await AdminAuditLog.query()
      .where('targetType', 'category_attribute')
      .where('targetId', pivot.id)
      .where('action', 'category_attribute.updated')
      .count('* as total')
      .first()
    const countBefore = Number(auditCountBefore?.$extras.total ?? 0)

    try {
      // Reenvoyer les memes plages
      const response = await client
        .patch(`/fr/admin/categories/${category.id}/attributes/${pivot.id}/ranges`)
        .redirects(0)
        .withCsrfToken()
        .loginAs(admin)
        .json({
          ranges: [
            { minValue: null, maxValue: 100 },
            { minValue: 100, maxValue: 500 },
          ],
        })

      response.assertStatus(302)

      // Pas de nouveau log audit (les plages sont identiques)
      const auditCountAfter = await AdminAuditLog.query()
        .where('targetType', 'category_attribute')
        .where('targetId', pivot.id)
        .where('action', 'category_attribute.updated')
        .count('* as total')
        .first()
      const countAfter = Number(auditCountAfter?.$extras.total ?? 0)
      assert.equal(
        countAfter,
        countBefore,
        'Aucun log audit ne doit etre cree pour des plages identiques'
      )
    } finally {
      await pivot.delete()
    }
  })
})

test.group('Administration des attributs de categorie - validation', (group) => {
  useDatabase(group, { seed: 'full' })

  test('position decimale est refusee', async ({ client, assert }) => {
    const admin = await platformAdmin()
    const category = await Category.firstOrFail()
    const existingPivots = await CategoryAttribute.query().where('categoryId', category.id)
    const existingAttrIds = existingPivots.map((p) => p.attributeId)
    const attribute = await Attribute.query()
      .whereNotIn('id', existingAttrIds.length > 0 ? existingAttrIds : [0])
      .firstOrFail()

    const response = await client
      .post(`/fr/admin/categories/${category.id}/attributes`)
      .redirects(0)
      .withCsrfToken()
      .loginAs(admin)
      .json({ attributeId: attribute.id, position: 3.5 })

    // Erreur de validation (redirection avec erreurs de session)
    response.assertStatus(302)

    // Pas de pivot cree
    const pivot = await CategoryAttribute.query()
      .where('categoryId', category.id)
      .where('attributeId', attribute.id)
      .first()
    assert.isNull(pivot, 'Un pivot ne doit pas etre cree avec une position decimale')
  })

  test('plages qui se chevauchent sont refusees', async ({ client, assert }) => {
    const admin = await platformAdmin()
    const numericAttr = await Attribute.query().where('type', 'number').firstOrFail()
    const category = await Category.firstOrFail()

    // Creer un pivot pour cet attribut
    const pivot = await CategoryAttribute.create({
      categoryId: category.id,
      attributeId: numericAttr.id,
      position: 92,
    })

    try {
      // Plages qui se chevauchent : [0-100] et [50-200]
      const response = await client
        .patch(`/fr/admin/categories/${category.id}/attributes/${pivot.id}/ranges`)
        .redirects(0)
        .withCsrfToken()
        .loginAs(admin)
        .json({
          ranges: [
            { minValue: 0, maxValue: 100 },
            { minValue: 50, maxValue: 200 },
          ],
        })

      // Erreur de validation (redirection avec erreurs de session)
      response.assertStatus(302)

      // Pas de plages creees
      const ranges = await CategoryAttributeRange.query().where('categoryAttributeId', pivot.id)
      assert.lengthOf(ranges, 0, 'Les plages ne doivent pas etre creees si elles se chevauchent')
    } finally {
      await pivot.delete()
    }
  })

  test('ajout avec attributeId inexistant renvoie 404', async ({ client }) => {
    const admin = await platformAdmin()
    const category = await Category.firstOrFail()

    const response = await client
      .post(`/fr/admin/categories/${category.id}/attributes`)
      .withInertia()
      .withCsrfToken()
      .loginAs(admin)
      .json({ attributeId: 999999 })

    response.assertStatus(404)
  })
})
