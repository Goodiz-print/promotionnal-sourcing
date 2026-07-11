import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { isPostgres } from '#tests/utils/database'
import MainSeeder from '#database/seeders/main_seeder'
import Organization from '#models/organization'
import User from '#models/user'
import Category from '#models/category'
import AttributeValue from '#models/attribute_value'
import Product from '#models/product'
import ProductTranslation from '#models/product_translation'

async function devUserWithCurrentOrg(slug: string): Promise<User> {
  const org = await Organization.findByOrFail('slug', slug)
  const user = await User.findByOrFail('email', 'malolebrin@gmail.com')
  await user.merge({ currentOrganizationId: org.id }).save()
  return user
}

test.group('Gestion produits fournisseur — CRUD', (group) => {
  if (isPostgres()) {
    group.each.setup(() => testUtils.db().truncate())
    group.each.setup(() => new MainSeeder(db.connection()).run())
  } else {
    group.tap((t) => t.skip(true, 'Requiert PostgreSQL (seed catalogue pgvector/tsvector)'))
  }

  test('le fournisseur crée un produit (translations + facettes) publié au catalogue', async ({
    client,
    assert,
  }) => {
    const user = await devUserWithCurrentOrg('eurogoods-org')
    const crayon = await Category.findByOrFail('slug', 'crayon')
    const blue = await AttributeValue.findByOrFail('value', 'blue')

    const response = await client
      .post('/fr/supplier/products')
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json({
        categoryId: crayon.id,
        translations: {
          fr: { name: 'Mug Test', description: 'Mug en céramique' },
          en: { name: 'Test Mug', description: 'Ceramic mug' },
        },
        priceMin: 1.2,
        priceMax: 3.4,
        currency: 'EUR',
        minQuantity: 50,
        originCountry: 'FR',
        madeInEurope: true,
        isActive: true,
        attributeValueIds: [blue.id],
      })

    response.assertStatus(200)
    response.assertInertiaComponent('supplier/products/index')

    const product = await Product.query()
      .where('slug', 'mug-test')
      .preload('attributeValues')
      .first()
    assert.isNotNull(product)
    assert.equal(product!.categoryId, crayon.id)
    assert.includeMembers(
      product!.attributeValues.map((v) => v.id),
      [blue.id]
    )

    const translation = await ProductTranslation.query()
      .where('productId', product!.id)
      .where('locale', 'en')
      .firstOrFail()
    assert.equal(translation.name, 'Test Mug')

    // Publié : visible dans le catalogue public.
    const catalogue = await client.get('/fr/products').withInertia()
    const slugs = catalogue.inertiaProps.products.data.map((p: { slug: string }) => p.slug)
    assert.include(slugs, 'mug-test')
  })

  test("la mise à jour modifie le produit d'un produit possédé", async ({ client, assert }) => {
    const user = await devUserWithCurrentOrg('eurogoods-org')
    const product = await Product.findByOrFail('slug', 'crayon-hb-bleu')

    const response = await client
      .post(`/fr/supplier/products/${product.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json({
        categoryId: product.categoryId,
        translations: {
          fr: { name: 'Crayon Modifié', description: null },
          en: { name: 'Modified Pencil', description: null },
        },
        isActive: false,
        attributeValueIds: [],
      })

    response.assertStatus(200)

    const translation = await ProductTranslation.query()
      .where('productId', product.id)
      .where('locale', 'fr')
      .firstOrFail()
    assert.equal(translation.name, 'Crayon Modifié')

    await product.refresh()
    assert.isFalse(product.isActive)
  })

  test('la suppression retire le produit possédé', async ({ client, assert }) => {
    const user = await devUserWithCurrentOrg('eurogoods-org')
    const product = await Product.findByOrFail('slug', 'crayon-hb-rouge')

    const response = await client
      .delete(`/fr/supplier/products/${product.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)

    response.assertStatus(200)
    assert.isNull(await Product.find(product.id))
  })

  test("éditer un produit d'un autre fournisseur renvoie 404", async ({ client }) => {
    const user = await devUserWithCurrentOrg('eurogoods-org')
    // 'crayon-aquarelle-bleu' appartient au fournisseur nordic-promo (autre org).
    const product = await Product.findByOrFail('slug', 'crayon-aquarelle-bleu')

    const response = await client
      .get(`/fr/supplier/products/${product.id}/edit`)
      .withInertia()
      .loginAs(user)

    response.assertStatus(404)
  })

  test('un membre acheteur ne peut pas gérer les produits (403)', async ({ client }) => {
    const user = await devUserWithCurrentOrg('promotionnal-sourcing')

    const response = await client.get('/fr/supplier/products').withInertia().loginAs(user)

    response.assertStatus(403)
  })
})
