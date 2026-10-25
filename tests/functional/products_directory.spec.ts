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
    assert.lengthOf(response.inertiaProps.products.data, 7)
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

  test('sans catégorie : les catégories sont exposées, la barre d’attributs est vide', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/fr/products').withInertia()

    response.assertStatus(200)
    assert.isAbove(response.inertiaProps.categories.length, 0)
    // Barre pilotée par la catégorie : aucune catégorie → aucun attribut.
    assert.deepEqual(response.inertiaProps.facetBar, { attributes: [], hasCounts: false })
  })

  test('avec une catégorie : la barre expose ses attributs filtrables résolus', async ({
    client,
    assert,
  }) => {
    const casquettes = await Category.findByOrFail('slug', 'casquettes-chapeaux-casquettes')
    const response = await client
      .get('/fr/products')
      .qs({ categoryId: casquettes.id })
      .withInertia()

    response.assertStatus(200)
    const slugs = response.inertiaProps.facetBar.attributes.map((a: { slug: string }) => a.slug)
    // Attributs hérités de l'ancêtre (color, material) + propres (cap-panels).
    assert.includeMembers(slugs, ['color', 'material', 'cap-panels'])
    const color = response.inertiaProps.facetBar.attributes.find(
      (a: { slug: string }) => a.slug === 'color'
    )
    assert.isAbove(color.values.length, 0)
    // Moteur de recherche inerte en test : pas de compteurs.
    assert.isFalse(response.inertiaProps.facetBar.hasCounts)
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
