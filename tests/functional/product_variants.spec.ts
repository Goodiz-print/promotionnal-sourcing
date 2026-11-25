import { test } from '@japa/runner'
import AttributeValue from '#models/attribute_value'
import Category from '#models/category'
import Product from '#models/product'
import ProductPriceTier from '#models/product_price_tier'
import ProductVariant from '#models/product_variant'
import { useDatabase } from '#tests/utils/setup'
import { seededDevUser } from '#tests/utils/organizations'

async function mugPayload(overrides: Record<string, unknown> = {}) {
  const category = await Category.findByOrFail('slug', 'crayon')
  const blue = await AttributeValue.findByOrFail('value', 'blue')
  const red = await AttributeValue.findByOrFail('value', 'red')
  return {
    payload: {
      categoryId: category.id,
      sourceLocale: 'fr',
      translations: { fr: { name: 'Mug Variantes', description: null } },
      currency: 'EUR',
      variants: [
        { sku: 'MUG-BLUE', attributeValueIds: [blue.id] },
        { sku: 'MUG-RED', attributeValueIds: [red.id] },
      ],
      priceTiers: [
        { minQuantity: 100, unitPrice: 4.5 },
        { minQuantity: 500, unitPrice: 3.2 },
        { minQuantity: 1000, unitPrice: 2.8 },
      ],
      ...overrides,
    },
    blue,
    red,
  }
}

test.group('Produits — variantes et paliers de prix', (group) => {
  useDatabase(group, { seed: 'full' })

  test('création avec variantes et paliers : fourchette de prix recalculée', async ({
    client,
    assert,
  }) => {
    const user = await seededDevUser('eurogoods-org')
    const { payload, blue } = await mugPayload({ priceMin: 99, priceMax: 120 })

    await client
      .post('/fr/supplier/products')
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json(payload)
      .then((r) => r.assertStatus(200))

    const product = await Product.query()
      .where('slug', 'mug-variantes')
      .preload('variants', (q) => q.orderBy('sku').preload('attributes'))
      .preload('priceTiers', (q) => q.orderBy('minQuantity'))
      .firstOrFail()

    assert.deepEqual(
      product.variants.map((v) => v.sku),
      ['MUG-BLUE', 'MUG-RED']
    )
    assert.deepEqual(
      product.variants[0].attributes.map((a) => a.attributeValueId),
      [blue.id]
    )
    assert.deepEqual(
      product.priceTiers.map((t) => [t.minQuantity, Number(t.unitPrice)]),
      [
        [100, 4.5],
        [500, 3.2],
        [1000, 2.8],
      ]
    )
    // price_min / price_max suivent les paliers, pas la saisie manuelle.
    assert.equal(Number(product.priceMin), 2.8)
    assert.equal(Number(product.priceMax), 4.5)
  })

  test('un SKU en double annule toute la création', async ({ client, assert }) => {
    const user = await seededDevUser('eurogoods-org')
    const { payload } = await mugPayload({
      variants: [{ sku: 'DUP' }, { sku: 'DUP' }],
      priceTiers: [],
    })

    await client
      .post('/fr/supplier/products')
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json(payload)

    assert.isNull(await Product.findBy('slug', 'mug-variantes'))
    assert.lengthOf(await ProductVariant.query().where('sku', 'DUP'), 0)
  })

  test('deux paliers de même quantité sont refusés (produit non créé)', async ({
    client,
    assert,
  }) => {
    const user = await seededDevUser('eurogoods-org')
    const { payload } = await mugPayload({
      priceTiers: [
        { minQuantity: 100, unitPrice: 4 },
        { minQuantity: 100, unitPrice: 3 },
      ],
    })

    await client
      .post('/fr/supplier/products')
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json(payload)

    assert.isNull(await Product.findBy('slug', 'mug-variantes'))
  })

  test('un palier ne peut viser qu’une variante existante', async ({ client, assert }) => {
    const user = await seededDevUser('eurogoods-org')
    const { payload } = await mugPayload({
      priceTiers: [{ variantSku: 'NOPE', minQuantity: 10, unitPrice: 1 }],
    })

    await client
      .post('/fr/supplier/products')
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json(payload)

    assert.isNull(await Product.findBy('slug', 'mug-variantes'))
  })

  test('la mise à jour remplace les variantes par SKU et recalcule le prix', async ({
    client,
    assert,
  }) => {
    const user = await seededDevUser('eurogoods-org')
    const { payload, red } = await mugPayload()
    await client
      .post('/fr/supplier/products')
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json(payload)

    const product = await Product.findByOrFail('slug', 'mug-variantes')
    const blueBefore = await ProductVariant.query()
      .where('productId', product.id)
      .where('sku', 'MUG-BLUE')
      .firstOrFail()

    await client
      .post(`/fr/supplier/products/${product.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json({
        // MUG-RED retiré, MUG-BLUE conservé (même id), MUG-GREEN ajouté.
        variants: [
          { sku: 'MUG-BLUE', isActive: false },
          { sku: 'MUG-GREEN', attributeValueIds: [red.id] },
        ],
        priceTiers: [
          { minQuantity: 50, unitPrice: 6 },
          { variantSku: 'MUG-GREEN', minQuantity: 50, unitPrice: 7.5 },
        ],
      })
      .then((r) => r.assertStatus(200))

    const variants = await ProductVariant.query().where('productId', product.id).orderBy('sku')
    assert.deepEqual(
      variants.map((v) => v.sku),
      ['MUG-BLUE', 'MUG-GREEN']
    )
    assert.equal(variants[0].id, blueBefore.id)
    assert.isFalse(variants[0].isActive)

    const tiers = await ProductPriceTier.query().where('productId', product.id)
    assert.lengthOf(tiers, 2)

    await product.refresh()
    assert.equal(Number(product.priceMin), 6)
    assert.equal(Number(product.priceMax), 7.5)
  })

  test('sans variants ni priceTiers dans le payload, rien ne change', async ({
    client,
    assert,
  }) => {
    const user = await seededDevUser('eurogoods-org')
    const { payload } = await mugPayload()
    await client
      .post('/fr/supplier/products')
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json(payload)
    const product = await Product.findByOrFail('slug', 'mug-variantes')

    await client
      .post(`/fr/supplier/products/${product.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json({ minQuantity: 25 })
      .then((r) => r.assertStatus(200))

    assert.lengthOf(await ProductVariant.query().where('productId', product.id), 2)
    assert.lengthOf(await ProductPriceTier.query().where('productId', product.id), 3)
  })

  test('la fiche publique expose variantes actives et grille de prix', async ({
    client,
    assert,
  }) => {
    const user = await seededDevUser('eurogoods-org')
    const { payload } = await mugPayload()
    payload.variants[1] = { ...payload.variants[1], isActive: false } as never
    await client
      .post('/fr/supplier/products')
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json(payload)

    const response = await client.get('/fr/products/mug-variantes').withInertia()
    response.assertStatus(200)
    const { variants, priceTiers } = response.inertiaProps.product

    assert.deepEqual(
      variants.map((v: { sku: string }) => v.sku),
      ['MUG-BLUE']
    )
    assert.isNotEmpty(variants[0].attributes)
    assert.deepEqual(
      priceTiers.map((t: { minQuantity: number }) => t.minQuantity),
      [100, 500, 1000]
    )
  })

  test('le catalogue se trie par prix du premier palier', async ({ client, assert }) => {
    const user = await seededDevUser('eurogoods-org')
    const crayon = await Category.findByOrFail('slug', 'crayon')
    const create = (name: string, unitPrice: number) =>
      client
        .post('/fr/supplier/products')
        .withInertia()
        .withCsrfToken()
        .loginAs(user)
        .json({
          categoryId: crayon.id,
          sourceLocale: 'fr',
          translations: { fr: { name } },
          priceTiers: [{ minQuantity: 100, unitPrice }],
        })
    await create('Zeta cher', 9)
    await create('Alpha moyen', 5)
    await create('Beta pas cher', 1)

    const response = await client.get('/fr/products?sort=price_asc').withInertia()
    const slugs = response.inertiaProps.products.data.map((p: { slug: string }) => p.slug)

    assert.isBelow(slugs.indexOf('beta-pas-cher'), slugs.indexOf('alpha-moyen'))
    assert.isBelow(slugs.indexOf('alpha-moyen'), slugs.indexOf('zeta-cher'))
    // Produits sans palier : après ceux qui en ont.
    assert.isBelow(slugs.indexOf('zeta-cher'), slugs.indexOf('crayon-hb-rouge'))
  })

  test('le SKU est unique par produit en base', async ({ assert }) => {
    const product = await Product.firstOrFail()
    await ProductVariant.create({ productId: product.id, sku: 'X1' })
    try {
      await ProductVariant.create({ productId: product.id, sku: 'X1' })
      assert.fail('duplicate SKU accepted')
    } catch (error) {
      assert.match((error as Error).message, /unique|duplicate/i)
    }
  })

  test('deux paliers produit de même quantité sont refusés en base', async ({ assert }) => {
    const product = await Product.firstOrFail()
    const data = { productId: product.id, variantId: null, minQuantity: 10, unitPrice: '1' }
    await ProductPriceTier.create(data)
    try {
      await ProductPriceTier.create(data)
      assert.fail('duplicate tier accepted')
    } catch (error) {
      assert.match((error as Error).message, /unique|duplicate/i)
    }
  })
})
