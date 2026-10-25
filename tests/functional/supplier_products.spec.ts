import { test } from '@japa/runner'
import Category from '#models/category'
import AttributeValue from '#models/attribute_value'
import Product from '#models/product'
import ProductTranslation from '#models/product_translation'
import { useDatabase } from '#tests/utils/setup'
import { seededDevUser } from '#tests/utils/organizations'

test.group('Gestion produits fournisseur — CRUD', (group) => {
  useDatabase(group, { seed: 'full' })

  test('le fournisseur crée un produit (translations + facettes) publié au catalogue', async ({
    client,
    assert,
  }) => {
    const user = await seededDevUser('eurogoods-org')
    const crayon = await Category.findByOrFail('slug', 'crayon')
    const blue = await AttributeValue.findByOrFail('value', 'blue')

    const response = await client
      .post('/fr/supplier/products')
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json({
        categoryId: crayon.id,
        sourceLocale: 'fr',
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
    const user = await seededDevUser('eurogoods-org')
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
    const user = await seededDevUser('eurogoods-org')
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
    const user = await seededDevUser('eurogoods-org')
    // 'crayon-aquarelle-bleu' appartient au fournisseur nordic-promo (autre org).
    const product = await Product.findByOrFail('slug', 'crayon-aquarelle-bleu')

    const response = await client
      .get(`/fr/supplier/products/${product.id}/edit`)
      .withInertia()
      .loginAs(user)

    response.assertStatus(404)
  })

  test('un membre acheteur ne peut pas gérer les produits (403)', async ({ client }) => {
    const user = await seededDevUser('promotionnal-sourcing')

    const response = await client.get('/fr/supplier/products').withInertia().loginAs(user)

    response.assertStatus(403)
  })
})
