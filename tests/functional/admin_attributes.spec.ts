import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import type User from '#models/user'
import Attribute from '#models/attribute'
import AttributeTranslation from '#models/attribute_translation'
import AttributeValue from '#models/attribute_value'
import AttributeValueTranslation from '#models/attribute_value_translation'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'
import type { RoleSlug } from '#shared/types/role'

/**
 * Membre d'une organisation acheteuse fraîche : prouve que le rôle d'organisation
 * n'ouvre pas l'administration des facettes.
 */
function freshOrgMember(roleSlug: RoleSlug = 'owner'): Promise<User> {
  return OrganizationFactory.create().then((organization) => createMember(organization, roleSlug))
}

function platformAdmin(): Promise<User> {
  return UserFactory.apply('platformAdmin').create()
}

const GRAMMAGE = {
  slug: 'grammage-test',
  type: 'number',
  unit: 'g/m²',
  isFilterable: true,
  sourceLocale: 'fr',
  translations: { fr: { name: 'Grammage' }, en: { name: 'Weight' } },
}

/** Première valeur d'attribut portée par au moins un produit. */
async function usedValue(): Promise<AttributeValue> {
  const row = await db
    .from('product_attributes')
    .whereNotNull('attribute_value_id')
    .select('attribute_value_id')
    .firstOrFail()
  return AttributeValue.findOrFail(row.attribute_value_id)
}

test.group('Administration des attributs — ACL', (group) => {
  useDatabase(group, { seed: 'full' })

  test('un admin plateforme voit la liste des attributs', async ({ client, assert }) => {
    const admin = await platformAdmin()

    const response = await client.get('/fr/admin/attributes').withInertia().loginAs(admin)

    response.assertStatus(200)
    response.assertInertiaComponent('admin/attributes/index')
    const color = response.inertiaProps!.attributes.find(
      (a: { slug: string }) => a.slug === 'color'
    )
    assert.isAbove(color.valuesCount, 0)
    assert.isAbove(color.productsCount, 0)
  })

  for (const roleSlug of ['owner', 'admin', 'manager', 'member'] as const) {
    test(`un ${roleSlug} d’organisation ordinaire ne peut pas gérer les attributs (403)`, async ({
      client,
      assert,
    }) => {
      const user = await freshOrgMember(roleSlug)
      const color = await Attribute.findByOrFail('slug', 'color')

      const list = await client.get('/fr/admin/attributes').withInertia().loginAs(user)
      const create = await client.get('/fr/admin/attributes/new').withInertia().loginAs(user)
      assert.equal(list.status(), 403)
      assert.equal(create.status(), 403)

      // Écritures refusées (le 403 devient un flash) et **sans effet** en base.
      const store = await client
        .post('/fr/admin/attributes')
        .redirects(0)
        .withCsrfToken()
        .loginAs(user)
        .json(GRAMMAGE)
      const storeValue = await client
        .post(`/fr/admin/attributes/${color.id}/values`)
        .redirects(0)
        .withCsrfToken()
        .loginAs(user)
        .json({ slug: 'intrus', sourceLocale: 'fr', translations: { fr: { label: 'Intrus' } } })
      const destroy = await client
        .delete(`/fr/admin/attributes/${color.id}`)
        .redirects(0)
        .withCsrfToken()
        .loginAs(user)
      assert.isAtLeast(store.status(), 302)
      assert.isAtLeast(storeValue.status(), 302)
      assert.isAtLeast(destroy.status(), 302)
      assert.isNull(await Attribute.findBy('slug', GRAMMAGE.slug))
      assert.isNull(await AttributeValue.findBy('slug', 'intrus'))
      assert.isNotNull(await Attribute.find(color.id))
    })
  }

  test('un visiteur anonyme est renvoyé vers la connexion', async ({ client }) => {
    const response = await client.get('/fr/admin/attributes').redirects(0)

    response.assertStatus(302)
    response.assertHeader(
      'location',
      `/fr/login?redirect=${encodeURIComponent('/fr/admin/attributes')}`
    )
  })
})

test.group('Administration des attributs — CRUD', (group) => {
  useDatabase(group, { seed: 'full' })

  test('création d’un attribut numérique avec ses traductions', async ({ client, assert }) => {
    const admin = await platformAdmin()

    const response = await client
      .post('/fr/admin/attributes')
      .withInertia()
      .withCsrfToken()
      .loginAs(admin)
      .json(GRAMMAGE)

    // Redirection vers l'écran d'édition, pour ajouter les valeurs.
    response.assertStatus(200)
    response.assertInertiaComponent('admin/attributes/edit')

    const attribute = await Attribute.findByOrFail('slug', GRAMMAGE.slug)
    assert.equal(attribute.type, 'number')
    assert.equal(attribute.unit, 'g/m²')
    assert.isTrue(attribute.isFilterable)
    assert.equal(attribute.sourceLocale, 'fr')

    const fr = await AttributeTranslation.query()
      .where('attributeId', attribute.id)
      .where('locale', 'fr')
      .firstOrFail()
    assert.equal(fr.name, 'Grammage')
    assert.isFalse(fr.isAuto)
  })

  test('le slug doit être unique', async ({ client, assert }) => {
    const admin = await platformAdmin()

    const response = await client
      .post('/fr/admin/attributes')
      .redirects(0)
      .withCsrfToken()
      .loginAs(admin)
      .json({ ...GRAMMAGE, slug: 'color' })

    response.assertStatus(302)
    assert.lengthOf(await Attribute.query().where('slug', 'color'), 1)
  })

  test('la traduction de la langue source est obligatoire', async ({ client, assert }) => {
    const admin = await platformAdmin()

    const response = await client
      .post('/fr/admin/attributes')
      .redirects(0)
      .withCsrfToken()
      .loginAs(admin)
      .json({ ...GRAMMAGE, translations: { en: { name: 'Weight' } } })

    response.assertStatus(302)
    assert.isNull(await Attribute.findBy('slug', GRAMMAGE.slug))
  })

  test('mise à jour du nom, de l’unité et de la filtrabilité ; slug et type sont figés', async ({
    client,
    assert,
  }) => {
    const admin = await platformAdmin()
    const material = await Attribute.findByOrFail('slug', 'material')
    const before = await AttributeTranslation.query()
      .where('attributeId', material.id)
      .where('locale', 'en')
      .firstOrFail()

    const response = await client
      .patch(`/fr/admin/attributes/${material.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(admin)
      .json({
        slug: 'autre',
        type: 'number',
        unit: 'kg',
        isFilterable: false,
        translations: { en: { name: `${before.name} (edited)` } },
      })

    response.assertStatus(200)
    response.assertInertiaComponent('admin/attributes/index')

    await material.refresh()
    assert.equal(material.slug, 'material')
    assert.equal(material.type, 'enum')
    assert.equal(material.unit, 'kg')
    assert.isFalse(material.isFilterable)

    await before.refresh()
    assert.equal(before.name.endsWith('(edited)'), true)
    assert.isFalse(before.isAuto)
  })

  test('suppression d’un attribut inutilisé', async ({ client, assert }) => {
    const admin = await platformAdmin()
    const attribute = await Attribute.create({
      slug: 'jetable',
      type: 'string',
      sourceLocale: 'fr',
      isFilterable: true,
    })

    const response = await client
      .delete(`/fr/admin/attributes/${attribute.id}`)
      .redirects(0)
      .withCsrfToken()
      .loginAs(admin)

    response.assertStatus(302)
    assert.isNull(await Attribute.find(attribute.id))
  })

  test('suppression refusée si des produits renseignent l’attribut', async ({ client, assert }) => {
    const admin = await platformAdmin()
    const used = await usedValue()

    const response = await client
      .delete(`/fr/admin/attributes/${used.attributeId}`)
      .redirects(0)
      .withCsrfToken()
      .loginAs(admin)

    response.assertStatus(302)
    assert.isNotNull(await Attribute.find(used.attributeId))
  })

  test('suppression refusée si une catégorie a retenu l’attribut', async ({ client, assert }) => {
    const admin = await platformAdmin()
    const row = await db.from('category_attributes').select('attribute_id').firstOrFail()
    await db.from('product_attributes').where('attribute_id', row.attribute_id).delete()

    const response = await client
      .delete(`/fr/admin/attributes/${row.attribute_id}`)
      .redirects(0)
      .withCsrfToken()
      .loginAs(admin)

    response.assertStatus(302)
    assert.isNotNull(await Attribute.find(row.attribute_id))
  })

  test('l’écran d’édition expose les valeurs et leur usage', async ({ client, assert }) => {
    const admin = await platformAdmin()
    const used = await usedValue()

    const response = await client
      .get(`/fr/admin/attributes/${used.attributeId}/edit`)
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    response.assertInertiaComponent('admin/attributes/edit')
    const values = response.inertiaProps!.attribute.values as Array<{
      id: number
      label: string
      productsCount: number
    }>
    const found = values.find((value) => value.id === used.id)
    assert.isAbove(found!.productsCount, 0)
    assert.isNotEmpty(found!.label)
  })

  test('un attribut inconnu renvoie 404', async ({ client }) => {
    const admin = await platformAdmin()

    const response = await client.get('/fr/admin/attributes/999999/edit').loginAs(admin)

    response.assertStatus(404)
  })
})

test.group('Administration des valeurs d’attribut', (group) => {
  useDatabase(group, { seed: 'full' })

  test('ajout d’une valeur avec synonymes et libellé', async ({ client, assert }) => {
    const admin = await platformAdmin()
    const color = await Attribute.findByOrFail('slug', 'color')

    const response = await client
      .post(`/fr/admin/attributes/${color.id}/values`)
      .withInertia()
      .withCsrfToken()
      .loginAs(admin)
      .json({
        slug: 'rouge-test',
        sourceLocale: 'fr',
        synonyms: ['rouge vif', 'red'],
        translations: { fr: { label: 'Rouge test' } },
      })

    response.assertStatus(200)

    const value = await AttributeValue.query()
      .where('attributeId', color.id)
      .where('slug', 'rouge-test')
      .firstOrFail()
    assert.equal(value.value, 'rouge-test')
    assert.deepEqual(value.synonyms, ['rouge vif', 'red'])
    const label = await AttributeValueTranslation.query()
      .where('attributeValueId', value.id)
      .where('locale', 'fr')
      .firstOrFail()
    assert.equal(label.label, 'Rouge test')
    assert.isFalse(label.isAuto)
  })

  test('le slug d’une valeur est unique au sein de l’attribut', async ({ client, assert }) => {
    const admin = await platformAdmin()
    const existing = await usedValue()

    const response = await client
      .post(`/fr/admin/attributes/${existing.attributeId}/values`)
      .redirects(0)
      .withCsrfToken()
      .loginAs(admin)
      .json({
        slug: existing.slug,
        sourceLocale: 'fr',
        translations: { fr: { label: 'Doublon' } },
      })

    response.assertStatus(302)
    const same = await AttributeValue.query()
      .where('attributeId', existing.attributeId)
      .where('slug', existing.slug)
    assert.lengthOf(same, 1)
  })

  test('mise à jour du libellé et des synonymes', async ({ client, assert }) => {
    const admin = await platformAdmin()
    const value = await usedValue()

    const response = await client
      .patch(`/fr/admin/attributes/${value.attributeId}/values/${value.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(admin)
      .json({
        sourceLocale: value.sourceLocale,
        synonyms: ['nouveau synonyme'],
        translations: { [value.sourceLocale]: { label: 'Libellé modifié' } },
      })

    response.assertStatus(200)

    await value.refresh()
    assert.deepEqual(value.synonyms, ['nouveau synonyme'])
    const label = await AttributeValueTranslation.query()
      .where('attributeValueId', value.id)
      .where('locale', value.sourceLocale)
      .firstOrFail()
    assert.equal(label.label, 'Libellé modifié')
    assert.isFalse(label.isAuto)
  })

  test('une valeur d’un autre attribut est introuvable (404)', async ({ client }) => {
    const admin = await platformAdmin()
    const value = await usedValue()
    const other = await Attribute.query().whereNot('id', value.attributeId).firstOrFail()

    const response = await client
      .patch(`/fr/admin/attributes/${other.id}/values/${value.id}`)
      .withCsrfToken()
      .loginAs(admin)
      .json({ synonyms: [] })

    response.assertStatus(404)
  })

  test('suppression d’une valeur inutilisée', async ({ client, assert }) => {
    const admin = await platformAdmin()
    const color = await Attribute.findByOrFail('slug', 'color')
    const value = await AttributeValue.create({
      attributeId: color.id,
      slug: 'jetable',
      value: 'jetable',
      sourceLocale: 'fr',
    })

    const response = await client
      .delete(`/fr/admin/attributes/${color.id}/values/${value.id}`)
      .redirects(0)
      .withCsrfToken()
      .loginAs(admin)

    response.assertStatus(302)
    assert.isNull(await AttributeValue.find(value.id))
  })

  test('suppression refusée si des produits portent la valeur', async ({ client, assert }) => {
    const admin = await platformAdmin()
    const value = await usedValue()

    const response = await client
      .delete(`/fr/admin/attributes/${value.attributeId}/values/${value.id}`)
      .redirects(0)
      .withCsrfToken()
      .loginAs(admin)

    response.assertStatus(302)
    assert.isNotNull(await AttributeValue.find(value.id))
  })

  test('suppression refusée si des nuances sont rattachées à la valeur', async ({
    client,
    assert,
  }) => {
    const admin = await platformAdmin()
    const child = await AttributeValue.query().whereNotNull('parentValueId').firstOrFail()
    const family = await AttributeValue.findOrFail(child.parentValueId!)
    await db.from('product_attributes').where('attribute_value_id', family.id).delete()

    const response = await client
      .delete(`/fr/admin/attributes/${family.attributeId}/values/${family.id}`)
      .redirects(0)
      .withCsrfToken()
      .loginAs(admin)

    response.assertStatus(302)
    assert.isNotNull(await AttributeValue.find(family.id))
  })
})
