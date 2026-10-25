import { test } from '@japa/runner'
import Category from '#models/category'
import AttributeValue from '#models/attribute_value'
import { useDatabase } from '#tests/utils/setup'

test.group('Catalogue public produits', (group) => {
  useDatabase(group, { seed: 'full', perTest: false })

  test('le catalogue liste les produits actifs', async ({ client, assert }) => {
    const response = await client.get('/fr/products').withInertia()

    response.assertStatus(200)
    response.assertInertiaComponent('products/index')
    assert.lengthOf(response.inertiaProps.products.data, 6)
    assert.equal(response.inertiaProps.products.meta.currentPage, 1)
    assert.isFalse(response.inertiaProps.searchUnavailable)
  })

  test('le filtre catégorie restreint la liste', async ({ client, assert }) => {
    const crayon = await Category.findByOrFail('slug', 'crayon')
    const response = await client.get('/fr/products').qs({ categoryId: crayon.id }).withInertia()

    response.assertStatus(200)
    assert.lengthOf(response.inertiaProps.products.data, 3)
  })

  test('facettes en ET fiable : catégorie=crayon ET couleur=blue → 2 crayons bleus', async ({
    client,
    assert,
  }) => {
    const crayon = await Category.findByOrFail('slug', 'crayon')
    const blue = await AttributeValue.findByOrFail('value', 'blue')

    const response = await client
      .get('/fr/products')
      .qs({ categoryId: crayon.id, attributeValueIds: [blue.id] })
      .withInertia()

    response.assertStatus(200)
    const slugs = response.inertiaProps.products.data.map((p: { slug: string }) => p.slug).sort()
    assert.deepEqual(slugs, ['crayon-aquarelle-bleu', 'crayon-hb-bleu'])
  })

  test('la barre de facettes expose catégories et attributs filtrables', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/fr/products').withInertia()

    response.assertStatus(200)
    assert.isAbove(response.inertiaProps.categories.length, 0)
    const colors = response.inertiaProps.attributes.find(
      (a: { slug: string }) => a.slug === 'color'
    )
    assert.exists(colors)
    assert.isAbove(colors.values.length, 0)
  })

  test('la fiche produit expose fournisseur, catégorie et facettes', async ({ client, assert }) => {
    const response = await client.get('/fr/products/crayon-aquarelle-bleu').withInertia()

    response.assertStatus(200)
    response.assertInertiaComponent('products/show')
    const product = response.inertiaProps.product
    assert.equal(product.name, 'Crayon Aquarelle Bleu')
    assert.equal(product.supplier.slug, 'nordic-promo')
    assert.equal(product.category.slug, 'crayon')
    assert.isAbove(product.attributes.length, 0)
  })

  test('la fiche est localisée selon la locale (EN)', async ({ client, assert }) => {
    const response = await client.get('/en/products/crayon-aquarelle-bleu').withInertia()

    response.assertStatus(200)
    assert.equal(response.inertiaProps.product.name, 'Blue Watercolor Pencil')
  })

  test('une fiche inconnue renvoie 404', async ({ client }) => {
    const response = await client.get('/fr/products/inconnu').withInertia()
    response.assertStatus(404)
  })
})
