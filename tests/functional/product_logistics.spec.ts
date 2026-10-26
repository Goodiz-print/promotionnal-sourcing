import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import Category from '#models/category'
import Product from '#models/product'
import ProductPackaging from '#models/product_packaging'
import { ProductPackagingFactory } from '#database/factories/product_packaging_factory'
import { useDatabase } from '#tests/utils/setup'
import { seededDevUser } from '#tests/utils/organizations'

/**
 * Logistique / conditionnement produit (écart 3) : persistance 1:1 (upsert),
 * sérialisation (décimal `outerCartonVolumeM3` en chaîne), « absent = inchangé »
 * à la mise à jour, et cascade de suppression avec le produit.
 */
test.group('Logistique produit — conditionnement 1:1 (écart 3)', (group) => {
  useDatabase(group, { seed: 'full' })

  /** Crée un produit fournisseur via l'endpoint et renvoie la ligne rechargée. */
  async function createProduct(
    client: ApiClient,
    slug: string,
    overrides: Record<string, unknown>
  ): Promise<Product> {
    const user = await seededDevUser('eurogoods-org')
    const crayon = await Category.findByOrFail('slug', 'crayon')

    const response = await client
      .post('/fr/supplier/products')
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json({
        categoryId: crayon.id,
        sourceLocale: 'fr',
        translations: {
          fr: { name: slug, description: null },
          en: { name: slug, description: null },
        },
        isActive: true,
        ...overrides,
      })
    response.assertStatus(200)

    return Product.query().where('slug', slug).preload('packaging').firstOrFail()
  }

  /** Tente une création et renvoie la réponse brute (sans assertion de statut). */
  function attemptCreate(client: ApiClient, slug: string, packaging: Record<string, unknown>) {
    return (async () => {
      const user = await seededDevUser('eurogoods-org')
      const crayon = await Category.findByOrFail('slug', 'crayon')
      return client
        .post('/fr/supplier/products')
        .withInertia()
        .withCsrfToken()
        .loginAs(user)
        .json({
          categoryId: crayon.id,
          sourceLocale: 'fr',
          translations: { fr: { name: slug, description: null }, en: { name: slug } },
          isActive: true,
          packaging,
        })
    })()
  }

  test('persiste le conditionnement (crée l’unique ligne 1:1)', async ({ client, assert }) => {
    const product = await createProduct(client, 'logistique-creation', {
      packaging: {
        packageType: 'Boîte cadeau',
        unitGrossWeightG: 120,
        innerCartonQty: 12,
        outerCartonQty: 144,
        outerCartonLengthMm: 400,
        outerCartonWidthMm: 300,
        outerCartonHeightMm: 250,
        outerCartonGrossWeightG: 18000,
        outerCartonVolumeM3: 0.03,
      },
    })

    assert.isNotNull(product.packaging)
    assert.equal(product.packaging!.packageType, 'Boîte cadeau')
    assert.equal(product.packaging!.unitGrossWeightG, 120)
    assert.equal(product.packaging!.outerCartonQty, 144)
    // Décimal sérialisé en chaîne par Lucid.
    assert.isString(product.packaging!.outerCartonVolumeM3)
    assert.equal(Number(product.packaging!.outerCartonVolumeM3), 0.03)

    // Relation 1:1 : une seule ligne pour ce produit.
    const rows = await ProductPackaging.query().where('productId', product.id)
    assert.lengthOf(rows, 1)
  })

  test('la mise à jour fait un upsert 1:1 (met à jour, pas de doublon)', async ({
    client,
    assert,
  }) => {
    const product = await createProduct(client, 'logistique-upsert', {
      packaging: { packageType: 'Polybag', unitGrossWeightG: 50 },
    })
    const user = await seededDevUser('eurogoods-org')

    const response = await client
      .post(`/fr/supplier/products/${product.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json({ packaging: { packageType: 'Tube', unitGrossWeightG: 80, outerCartonQty: 200 } })
    response.assertStatus(200)

    const rows = await ProductPackaging.query().where('productId', product.id)
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].packageType, 'Tube')
    assert.equal(rows[0].unitGrossWeightG, 80)
    assert.equal(rows[0].outerCartonQty, 200)
  })

  test('mise à jour sans bloc `packaging` : conditionnement inchangé', async ({
    client,
    assert,
  }) => {
    const product = await createProduct(client, 'logistique-inchange', {
      packaging: { packageType: 'Étui', unitGrossWeightG: 42 },
    })
    const user = await seededDevUser('eurogoods-org')

    // Pas de clé `packaging` : le bloc ne doit pas être touché.
    const response = await client
      .post(`/fr/supplier/products/${product.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json({ brand: 'Nouvelle marque' })
    response.assertStatus(200)

    const packaging = await ProductPackaging.query().where('productId', product.id).firstOrFail()
    assert.equal(packaging.packageType, 'Étui')
    assert.equal(packaging.unitGrossWeightG, 42)
  })

  test('la fiche publique sérialise le conditionnement', async ({ client, assert }) => {
    await createProduct(client, 'logistique-fiche', {
      packaging: { packageType: 'Vrac', outerCartonVolumeM3: 0.125 },
    })

    const response = await client.get('/fr/products/logistique-fiche').withInertia()
    response.assertStatus(200)

    const packaging = response.inertiaProps.product.packaging
    assert.isNotNull(packaging)
    assert.equal(packaging.packageType, 'Vrac')
    assert.equal(Number(packaging.outerCartonVolumeM3), 0.125)
  })

  test('la suppression du produit emporte son conditionnement (cascade)', async ({
    client,
    assert,
  }) => {
    const product = await createProduct(client, 'logistique-cascade', {
      packaging: { packageType: 'Blister', unitGrossWeightG: 15 },
    })
    const user = await seededDevUser('eurogoods-org')

    const response = await client
      .delete(`/fr/supplier/products/${product.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
    response.assertStatus(200)

    const rows = await ProductPackaging.query().where('productId', product.id)
    assert.lengthOf(rows, 0)
  })

  test('un bloc entièrement vide ne crée pas de ligne', async ({ client, assert }) => {
    const product = await createProduct(client, 'logistique-vide', {
      packaging: {
        packageType: null,
        unitGrossWeightG: null,
        outerCartonVolumeM3: null,
      },
    })

    assert.isNull(product.packaging)
    const rows = await ProductPackaging.query().where('productId', product.id)
    assert.lengthOf(rows, 0)
  })

  test('vider le bloc à l’édition supprime la ligne', async ({ client, assert }) => {
    const product = await createProduct(client, 'logistique-effacement', {
      packaging: { packageType: 'Tube', unitGrossWeightG: 70 },
    })
    assert.lengthOf(await ProductPackaging.query().where('productId', product.id), 1)

    const user = await seededDevUser('eurogoods-org')
    const response = await client
      .post(`/fr/supplier/products/${product.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json({ packaging: { packageType: null, unitGrossWeightG: null } })
    response.assertStatus(200)

    const rows = await ProductPackaging.query().where('productId', product.id)
    assert.lengthOf(rows, 0)
  })

  test('remplacement complet : un champ absent de l’objet est remis à null', async ({
    client,
    assert,
  }) => {
    const product = await createProduct(client, 'logistique-remplacement', {
      packaging: { packageType: 'Boîte cadeau', unitGrossWeightG: 90, outerCartonQty: 100 },
    })
    const user = await seededDevUser('eurogoods-org')

    // L'objet fourni ne contient que `packageType` : poids et quantité (absents)
    // doivent repasser à null (remplacement complet, pas un merge partiel).
    const response = await client
      .post(`/fr/supplier/products/${product.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json({ packaging: { packageType: 'Étui' } })
    response.assertStatus(200)

    const packaging = await ProductPackaging.query().where('productId', product.id).firstOrFail()
    assert.equal(packaging.packageType, 'Étui')
    assert.isNull(packaging.unitGrossWeightG)
    assert.isNull(packaging.outerCartonQty)
  })

  test('refuse un entier hors bornes sans 500 ni produit à moitié créé', async ({
    client,
    assert,
  }) => {
    // 3 000 000 000 > max `integer` PostgreSQL : doit être rejeté par la
    // validation (pas un `out of range` 500 qui perdrait la sauvegarde).
    const response = await attemptCreate(client, 'logistique-overflow', {
      unitGrossWeightG: 3_000_000_000,
    })
    response.assertStatus(200)

    const product = await Product.findBy('slug', 'logistique-overflow')
    assert.isNull(product)
  })

  test('refuse valeurs invalides : négatif, décimal sur entier, type trop long', async ({
    client,
    assert,
  }) => {
    const negative = await attemptCreate(client, 'logistique-negatif', { unitGrossWeightG: -5 })
    negative.assertStatus(200)

    const fractional = await attemptCreate(client, 'logistique-decimal', { innerCartonQty: 2.5 })
    fractional.assertStatus(200)

    const tooLong = await attemptCreate(client, 'logistique-type-long', {
      packageType: 'x'.repeat(121),
    })
    tooLong.assertStatus(200)

    for (const slug of ['logistique-negatif', 'logistique-decimal', 'logistique-type-long']) {
      assert.isNull(await Product.findBy('slug', slug))
    }
  })

  test('la factory crée un conditionnement rattaché à un produit', async ({ assert }) => {
    const product = await Product.findByOrFail('slug', 'crayon-hb-bleu')
    const packaging = await ProductPackagingFactory.merge({ productId: product.id }).create()

    await packaging.refresh()
    assert.equal(packaging.productId, product.id)
    assert.isString(packaging.outerCartonVolumeM3)
  })
})
