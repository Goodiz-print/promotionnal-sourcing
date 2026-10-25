import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import Category from '#models/category'
import Product from '#models/product'
import ProductTranslation from '#models/product_translation'
import ProductVariant from '#models/product_variant'
import { useDatabase } from '#tests/utils/setup'
import { seededDevUser } from '#tests/utils/organizations'

/**
 * ÉTAPE 2 — identité/classification (écart 5), commercial (écart 7), médias
 * (écart 8) et provenance (écart 9). Persistance des nouveaux champs par le
 * formulaire fournisseur, dérivation de `origin_zone`, filtres provenance et
 * Nouveautés du catalogue.
 */
test.group('Produit — identité, commercial, médias', (group) => {
  useDatabase(group, { seed: 'full' })

  test('le fournisseur saisit les nouveaux champs, origin_zone est dérivée', async ({
    client,
    assert,
  }) => {
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
          fr: {
            name: 'Gourde Inox',
            description: 'Gourde isotherme',
            keywords: ['gourde', 'inox'],
            marketingPoints: ['Sans BPA', 'Garantie 2 ans'],
          },
        },
        originCountry: 'DE',
        madeInEurope: true,
        isActive: true,
        brand: 'HydraPro',
        hsCode: '9617000',
        isConfigurable: true,
        lifecycleStatus: 'new',
        releasedAt: '2026-10-01',
        supplierCategoryRaw: 'Boissons & gourdes',
        leadTimeDays: 30,
        rushService: true,
        rushLeadTimeDays: 10,
        videoUrl: 'https://videos.example/gourde.mp4',
        variants: [{ sku: 'GRD-INOX', gtin: '3401234567890' }],
      })

    response.assertStatus(200)

    const product = await Product.query().where('slug', 'gourde-inox').firstOrFail()
    assert.equal(product.brand, 'HydraPro')
    assert.equal(product.hsCode, '9617000')
    assert.isTrue(product.isConfigurable)
    assert.equal(product.lifecycleStatus, 'new')
    assert.equal(product.releasedAt?.toISODate(), '2026-10-01')
    assert.equal(product.supplierCategoryRaw, 'Boissons & gourdes')
    assert.equal(product.leadTimeDays, 30)
    assert.isTrue(product.rushService)
    assert.equal(product.rushLeadTimeDays, 10)
    assert.equal(product.videoUrl, 'https://videos.example/gourde.mp4')
    // DE + madeInEurope → europe (dérivée, jamais saisie).
    assert.equal(product.originZone, 'europe')

    const fr = await ProductTranslation.query()
      .where('productId', product.id)
      .where('locale', 'fr')
      .firstOrFail()
    assert.deepEqual(fr.keywords, ['gourde', 'inox'])
    assert.deepEqual(fr.marketingPoints, ['Sans BPA', 'Garantie 2 ans'])

    const variant = await ProductVariant.query().where('productId', product.id).firstOrFail()
    assert.equal(variant.gtin, '3401234567890')
  })

  test('changer le pays recalcule origin_zone à la mise à jour', async ({ client, assert }) => {
    const user = await seededDevUser('eurogoods-org')
    const product = await Product.findByOrFail('slug', 'crayon-hb-bleu')
    assert.equal(product.originZone, 'france')

    await client
      .post(`/fr/supplier/products/${product.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json({ originCountry: 'CN', madeInEurope: false })

    await product.refresh()
    assert.equal(product.originCountry, 'CN')
    // CN connu hors Europe → other.
    assert.equal(product.originZone, 'other')
  })
})

test.group('Catalogue — filtres provenance et Nouveautés', (group) => {
  useDatabase(group, { seed: 'full' })

  async function catalogueSlugs(client: ApiClient, qs: Record<string, unknown>): Promise<string[]> {
    const response = await client.get('/fr/products').qs(qs).withInertia()
    return response.inertiaProps.products.data.map((p: { slug: string }) => p.slug)
  }

  test('provenance France ne renvoie que les produits français', async ({ client, assert }) => {
    const slugs = await catalogueSlugs(client, { originZones: ['france'] })
    // Seeds FR : crayon-hb-bleu, crayon-hb-rouge, casquette-6-panneaux-marine.
    assert.includeMembers(slugs, ['crayon-hb-bleu', 'crayon-hb-rouge'])
    // Pas les produits SE/ES (europe).
    assert.notInclude(slugs, 'crayon-aquarelle-bleu')
    assert.notInclude(slugs, 'stylo-bille-bleu')
  })

  test('France OU Europe cumule les deux zones', async ({ client, assert }) => {
    const slugs = await catalogueSlugs(client, { originZones: ['france', 'europe'] })
    assert.includeMembers(slugs, ['crayon-hb-bleu', 'crayon-aquarelle-bleu', 'stylo-bille-bleu'])
  })

  test('un produit sans origine est exclu des cases France/Europe', async ({ client, assert }) => {
    const product = await Product.findByOrFail('slug', 'crayon-hb-bleu')
    // Origine inconnue : origin_zone null (simule un import sans pays).
    await product.merge({ originCountry: null, madeInEurope: false, originZone: null }).save()

    const franceEurope = await catalogueSlugs(client, { originZones: ['france', 'europe'] })
    assert.notInclude(franceEurope, 'crayon-hb-bleu')
  })

  test('le filtre Nouveautés ne renvoie que les produits récemment sortis', async ({
    client,
    assert,
  }) => {
    const slugs = await catalogueSlugs(client, { newOnly: 'true' })
    // Seul le produit de démo « casquette » porte une date de sortie récente.
    assert.include(slugs, 'casquette-6-panneaux-marine')
    assert.notInclude(slugs, 'crayon-hb-bleu')
  })
})
