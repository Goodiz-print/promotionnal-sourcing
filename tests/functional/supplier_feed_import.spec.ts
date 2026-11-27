import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import Product from '#models/product'
import ProductVariant from '#models/product_variant'
import ProductPriceTier from '#models/product_price_tier'
import ProductImage from '#models/product_image'
import ProductMarkingPosition from '#models/product_marking_position'
import ProductMarkingPriceTier from '#models/product_marking_price_tier'
import AttributeValue from '#models/attribute_value'
import Category from '#models/category'
import MarkingTechnique from '#models/marking_technique'
import Supplier from '#models/supplier'
import SupplierHttpClient from '#services/supplier_feed/supplier_http_client'
import SupplierCatalogueImporter, {
  PRODUCT_IDENTITY_CONSTRAINTS,
} from '#services/supplier_feed/supplier_catalogue_importer'
import ProductVariantService from '#services/product_variant_service'
import SupplierConnectorRegistry from '#services/supplier_feed/supplier_connector_registry'
import { FALLBACK_CATEGORY_SLUG } from '#services/supplier_feed/supplier_reference_service'
import {
  SupplierFeedIncompleteException,
  UnknownSupplierConnectorException,
} from '#exceptions/supplier_feed_errors'
import { CertificationFactory } from '#database/factories/certification_factory'
import { useDatabase } from '#tests/utils/setup'
import { useFakeStorage } from '#tests/utils/storage'
import {
  FailingOnceVariantService,
  FakeSupplierHttpClient,
  InMemorySupplierConnector,
  normalizedProduct,
} from '#tests/utils/supplier_feed'
import type { SupplierImportOptions } from '#shared/types/supplier_feed'

const OPTIONS: SupplierImportOptions = {
  limit: 200,
  locale: 'fr',
  dryRun: false,
  storeImages: false,
  skipImages: false,
}

/** Import via le conteneur (dépendances réelles), sur un connecteur en mémoire. */
async function runImport(connector: InMemorySupplierConnector, options = OPTIONS) {
  const importer = await app.container.make(SupplierCatalogueImporter)
  return importer.import(connector, options)
}

const MARKED = normalizedProduct({
  materialLabels: ['Plastique'],
  variants: [
    {
      sku: 'EXT-1-NAVY',
      colorLabel: 'Bleu marine 02',
      gtin: '1234567890123',
      stockQuantity: 25,
      priceTiers: [],
      images: [],
    },
    {
      sku: 'EXT-1-RED',
      colorLabel: 'Rouge',
      gtin: null,
      stockQuantity: 0,
      priceTiers: [],
      images: [],
    },
  ],
  markingPositions: [
    {
      name: 'Clip',
      maxWidthMm: 40,
      maxHeightMm: 8,
      techniques: [
        {
          label: 'SERIGRAPHIE',
          maxColors: 2,
          setupCharge: 35,
          priceTiers: [{ minQuantity: 100, unitPrice: 0.2 }],
        },
        { label: 'Technique inconnue XYZ', maxColors: 1, setupCharge: null, priceTiers: [] },
      ],
    },
  ],
})

test.group('Import de catalogue fournisseur', (group) => {
  useDatabase(group, { seed: 'full' })

  test('crée fournisseur, fiche, variantes, paliers, facettes et marquage', async ({ assert }) => {
    const summary = await runImport(new InMemorySupplierConnector([MARKED]))

    assert.include(summary, { fetched: 1, created: 1, updated: 0, failed: 0 })
    assert.deepEqual(summary.unmatchedTechniques, ['Technique inconnue XYZ'])

    const supplier = await Supplier.findByOrFail('slug', 'fixture-supplier')
    const product = await Product.query()
      .where('supplierId', supplier.id)
      .where('externalId', 'EXT-1')
      .preload('translations')
      .preload('attributeValues')
      .firstOrFail()

    assert.equal(product.slug, 'fixture-supplier-ext-1')
    assert.equal(product.translations[0].name, 'Stylo bille fixture')
    assert.equal(Number(product.priceMin), 1.2)
    assert.equal(product.originZone, 'france')
    assert.equal(product.stockStatus, 'in_stock')
    assert.isTrue(product.printable)
    assert.equal(product.imageUrl, 'https://images.fixture.example/ext-1.jpg')

    const category = await Category.findOrFail(product.categoryId)
    assert.notEqual(category.slug, FALLBACK_CATEGORY_SLUG)

    // « Bleu marine 02 » → nuance bleu marine + sa famille ; « Plastique » → matière.
    const facetSlugs = product.attributeValues.map((value) => value.slug)
    assert.includeMembers(facetSlugs, ['bleu-marine', 'blue', 'red', 'plastic'])

    const navy = await ProductVariant.query()
      .where('productId', product.id)
      .where('sku', 'EXT-1-NAVY')
      .preload('attributes')
      .firstOrFail()
    const navyValues = await AttributeValue.query().whereIn(
      'id',
      navy.attributes.map((attribute) => attribute.attributeValueId)
    )
    assert.sameMembers(
      navyValues.map((value) => value.slug),
      ['bleu-marine', 'blue']
    )
    assert.equal(navy.stockStatus, 'in_stock')

    const [position] = await ProductMarkingPosition.query()
      .where('productId', product.id)
      .preload('techniques')
    const screen = await MarkingTechnique.findByOrFail('slug', 'screen-printing')
    assert.deepEqual(
      position.techniques.map((technique) => technique.markingTechniqueId),
      [screen.id]
    )
    const markingTiers = await ProductMarkingPriceTier.query().where('productId', product.id)
    assert.lengthOf(markingTiers, 1)
  })

  test('second import idempotent : mise à jour, prix remplacés, aucun doublon', async ({
    assert,
  }) => {
    await runImport(new InMemorySupplierConnector([MARKED]))

    const repriced = {
      ...MARKED,
      name: 'Stylo bille fixture v2',
      priceTiers: [{ minQuantity: 250, unitPrice: 0.99 }],
      variants: [MARKED.variants[0]],
    }
    const summary = await runImport(new InMemorySupplierConnector([repriced]))
    assert.include(summary, { created: 0, updated: 1, failed: 0 })

    const products = await Product.query().where('externalId', 'EXT-1')
    assert.lengthOf(products, 1)
    const tiers = await ProductPriceTier.query().where('productId', products[0].id)
    assert.deepEqual(
      tiers.map((tier) => [tier.minQuantity, Number(tier.unitPrice)]),
      [[250, 0.99]]
    )
    const variants = await ProductVariant.query().where('productId', products[0].id)
    assert.deepEqual(
      variants.map((variant) => variant.sku),
      ['EXT-1-NAVY']
    )
    const images = await ProductImage.query().where('productId', products[0].id)
    assert.lengthOf(images, 1)
  })

  test('catégorie non reconnue → « Non classé », signalée au bilan', async ({ assert }) => {
    const odd = normalizedProduct({
      externalId: 'EXT-ODD',
      name: 'Zorglub quantique',
      categoryRaw: 'Rubrique inexistante',
      variants: [],
    })
    const summary = await runImport(new InMemorySupplierConnector([odd]))

    assert.deepEqual(summary.unmatchedCategories, ['Rubrique inexistante'])
    const product = await Product.findByOrFail('externalId', 'EXT-ODD')
    const category = await Category.findOrFail(product.categoryId)
    assert.equal(category.slug, FALLBACK_CATEGORY_SLUG)
  })

  test('dry-run : bilan calculé, rien d’écrit (pas même « Non classé »)', async ({ assert }) => {
    const odd = normalizedProduct({
      externalId: 'EXT-ODD',
      name: 'Zorglub quantique',
      categoryRaw: 'Rubrique inexistante',
    })
    const summary = await runImport(new InMemorySupplierConnector([MARKED, odd]), {
      ...OPTIONS,
      dryRun: true,
    })

    assert.include(summary, { fetched: 2, created: 0, updated: 0 })
    assert.deepEqual(summary.unmatchedCategories, ['Rubrique inexistante'])
    assert.isNull(await Supplier.findBy('slug', 'fixture-supplier'))
    assert.isNull(await Product.findBy('externalId', 'EXT-1'))
    assert.isNull(await Category.findBy('slug', FALLBACK_CATEGORY_SLUG))
  })

  test('une fiche désactivée n’est pas republiée par un nouvel import', async ({ assert }) => {
    await runImport(new InMemorySupplierConnector([MARKED]))
    const product = await Product.findByOrFail('externalId', 'EXT-1')
    await product.merge({ isActive: false }).save()

    await runImport(new InMemorySupplierConnector([MARKED]))
    await product.refresh()
    assert.isFalse(product.isActive)
  })

  test('flux complet : les fiches absentes sont désactivées', async ({ assert }) => {
    const other = normalizedProduct({ externalId: 'EXT-OTHER' })
    await runImport(new InMemorySupplierConnector([MARKED, other]))

    const summary = await runImport(new InMemorySupplierConnector([MARKED]))
    assert.equal(summary.deactivated, 1)
    const missing = await Product.findByOrFail('externalId', 'EXT-OTHER')
    const kept = await Product.findByOrFail('externalId', 'EXT-1')
    assert.isFalse(missing.isActive)
    assert.isTrue(kept.isActive)
  })

  test('import intégral (--full) : désactive même à volume égal ou supérieur', async ({
    assert,
  }) => {
    const other = normalizedProduct({ externalId: 'EXT-OTHER' })
    await runImport(new InMemorySupplierConnector([MARKED, other]))

    // Sans limite, le flux est complet par définition.
    const summary = await runImport(new InMemorySupplierConnector([MARKED]), {
      ...OPTIONS,
      limit: null,
    })
    assert.equal(summary.fetched, 1)
    assert.equal(summary.deactivated, 1)
    const missing = await Product.findByOrFail('externalId', 'EXT-OTHER')
    assert.isFalse(missing.isActive)
  })

  test('import intégral amputé d’un flux annexe : annulé, rien d’écrit ni désactivé', async ({
    assert,
  }) => {
    const other = normalizedProduct({ externalId: 'EXT-OTHER' })
    await runImport(new InMemorySupplierConnector([MARKED, other]))
    const tiersBefore = await ProductPriceTier.query().count('* as total')

    // Flux prix indisponible : la fiche arrive sans palier.
    const connector = new InMemorySupplierConnector([{ ...MARKED, priceTiers: [] }])
    connector.missingFeeds = ['prix']
    await assert.rejects(
      () => runImport(connector, { ...OPTIONS, limit: null }),
      SupplierFeedIncompleteException
    )

    const tiersAfter = await ProductPriceTier.query().count('* as total')
    assert.deepEqual(tiersAfter[0].$extras, tiersBefore[0].$extras)
    const stillActive = await Product.findByOrFail('externalId', 'EXT-OTHER')
    assert.isTrue(stillActive.isActive)
  })

  test('flux annexe manquant : signalé au bilan (dry-run et import limité)', async ({ assert }) => {
    const connector = new InMemorySupplierConnector([MARKED])
    connector.missingFeeds = ['stock', 'prix']

    const dryRun = await runImport(connector, { ...OPTIONS, limit: null, dryRun: true })
    assert.deepEqual(dryRun.missingFeeds, ['prix', 'stock'])

    const limited = await runImport(connector)
    assert.deepEqual(limited.missingFeeds, ['prix', 'stock'])
    assert.equal(limited.created, 1)
  })

  test('flux amputé : désactivation en masse refusée, sauf demande explicite', async ({
    assert,
  }) => {
    const catalogue = Array.from({ length: 12 }, (_, index) =>
      normalizedProduct({
        externalId: `EXT-${index}`,
        variants: [{ ...MARKED.variants[0], sku: `EXT-${index}-A` }],
      })
    )
    await runImport(new InMemorySupplierConnector(catalogue), { ...OPTIONS, limit: null })
    const activeCount = async () => {
      const rows = await Product.query().where('isActive', true).whereNotNull('externalId')
      return rows.length
    }

    // 11 fiches sur 12 disparues d'un coup : le flux est jugé amputé.
    const truncated = new InMemorySupplierConnector(catalogue.slice(0, 1))
    const guarded = await runImport(truncated, { ...OPTIONS, limit: null })
    assert.equal(guarded.deactivated, 0)
    assert.equal(guarded.deactivationSkipped, 11)
    assert.equal(await activeCount(), 12)

    const forced = await runImport(truncated, {
      ...OPTIONS,
      limit: null,
      allowMassDeactivation: true,
    })
    assert.equal(forced.deactivated, 11)
    assert.equal(forced.deactivationSkipped, 0)
    assert.equal(await activeCount(), 1)
  })

  test('flux tronqué par --limit : rien n’est désactivé', async ({ assert }) => {
    const other = normalizedProduct({ externalId: 'EXT-OTHER' })
    await runImport(new InMemorySupplierConnector([MARKED, other]))

    // 1 produit récupéré pour limit = 1 : le flux peut être tronqué.
    const summary = await runImport(new InMemorySupplierConnector([MARKED, other]), {
      ...OPTIONS,
      limit: 1,
    })
    assert.equal(summary.deactivated, 0)
    const stillActive = await Product.findByOrFail('externalId', 'EXT-OTHER')
    assert.isTrue(stillActive.isActive)
  })

  test('deux codes au même slug : suffixe, aucun échec', async ({ assert }) => {
    const summary = await runImport(
      new InMemorySupplierConnector([
        normalizedProduct({ externalId: 'AB 12', variants: [] }),
        normalizedProduct({ externalId: 'AB-12', variants: [] }),
      ])
    )
    assert.deepEqual(summary.errors, [])
    assert.include(summary, { created: 2, failed: 0 })
    const products = await Product.query().whereIn('externalId', ['AB 12', 'AB-12'])
    const slugs = products.map((product) => product.slug)
    assert.sameMembers(slugs, ['fixture-supplier-ab-12', 'fixture-supplier-ab-12-2'])
  })

  test('slug déjà suffixé en base : suffixe suivant, slugs voisins ignorés', async ({ assert }) => {
    await runImport(
      new InMemorySupplierConnector([
        normalizedProduct({ externalId: 'AB 12', variants: [] }),
        normalizedProduct({ externalId: 'AB-12', variants: [] }),
        normalizedProduct({ externalId: 'AB-12-EXTRA', variants: [] }),
      ])
    )
    const summary = await runImport(
      new InMemorySupplierConnector([normalizedProduct({ externalId: 'AB--12', variants: [] })])
    )
    assert.include(summary, { created: 1, failed: 0 })
    const product = await Product.findByOrFail('externalId', 'AB--12')
    assert.equal(product.slug, 'fixture-supplier-ab-12-3')
  })

  test('code au slug très long : base tronquée, suffixe dans la colonne', async ({ assert }) => {
    // `€` devient `euro` : 100 caractères donnent un slug de 400.
    const ids = ['€'.repeat(100), `${'€'.repeat(99)} `]
    const summary = await runImport(
      new InMemorySupplierConnector(
        ids.map((externalId) => normalizedProduct({ externalId, variants: [] }))
      )
    )
    assert.deepEqual(summary.errors, [])
    assert.include(summary, { created: 2, failed: 0 })
    const products = await Product.query().whereIn('externalId', ids)
    const slugs = products.map((product) => product.slug)
    const base = `fixture-supplier-${'euro'.repeat(100)}`.slice(0, 247)
    assert.sameMembers(slugs, [base, `${base}-2`])
  })

  test('violation d’unicité concurrente sur la fiche : transaction rejouée une fois', async ({
    assert,
  }) => {
    const variants = new FailingOnceVariantService(PRODUCT_IDENTITY_CONSTRAINTS[0])
    app.container.swap(ProductVariantService, () => variants)
    try {
      const summary = await runImport(new InMemorySupplierConnector([MARKED]))
      assert.deepEqual(summary.errors, [])
      assert.include(summary, { created: 1, failed: 0 })
    } finally {
      app.container.restore(ProductVariantService)
    }
    assert.equal(variants.calls, 2)
    const product = await Product.findByOrFail('externalId', 'EXT-1')
    assert.equal(product.slug, 'fixture-supplier-ext-1')
    assert.lengthOf(await ProductVariant.query().where('productId', product.id), 2)
  })

  test('violation d’unicité d’une autre contrainte : pas de nouvel essai', async ({ assert }) => {
    const variants = new FailingOnceVariantService('product_variants_product_id_sku_unique')
    app.container.swap(ProductVariantService, () => variants)
    try {
      const summary = await runImport(new InMemorySupplierConnector([MARKED]))
      assert.include(summary, { created: 0, failed: 1 })
    } finally {
      app.container.restore(ProductVariantService)
    }
    assert.equal(variants.calls, 1)
    assert.isNull(await Product.findBy('externalId', 'EXT-1'))
  })

  test('un label éco saisi au back-office survit à l’import', async ({ assert }) => {
    await runImport(new InMemorySupplierConnector([MARKED]))
    const product = await Product.findByOrFail('externalId', 'EXT-1')
    const label = await CertificationFactory.merge({ isEco: true }).create()
    await product.related('certifications').attach([label.id])

    await runImport(new InMemorySupplierConnector([MARKED]))
    await product.refresh()
    assert.isTrue(product.isEco)
  })

  test('une fiche invalide est comptée en échec sans bloquer les autres', async ({ assert }) => {
    const broken = normalizedProduct({
      externalId: 'EXT-BROKEN',
      // Palier en double : refusé par ProductVariantService.
      priceTiers: [
        { minQuantity: 100, unitPrice: 1 },
        { minQuantity: 100, unitPrice: 2 },
      ],
    })
    const fine = normalizedProduct({ externalId: 'EXT-FINE' })
    const summary = await runImport(new InMemorySupplierConnector([broken, fine]))

    assert.include(summary, { created: 1, failed: 1 })
    assert.equal(summary.errors[0].externalId, 'EXT-BROKEN')
    assert.isNull(await Product.findBy('externalId', 'EXT-BROKEN'))
    assert.isNotNull(await Product.findBy('externalId', 'EXT-FINE'))
  })

  test('le registre résout les connecteurs et refuse une clé inconnue', async ({ assert }) => {
    const registry = await app.container.make(SupplierConnectorRegistry)
    assert.deepEqual(
      registry.all().map((connector) => connector.key),
      ['pfconcept', 'passot', 'inspirion', 'makito']
    )
    assert.throws(() => registry.get('acme'), UnknownSupplierConnectorException)
  })
})

test.group('Import de catalogue fournisseur — images copiées (--store-images)', (group) => {
  useDatabase(group, { seed: 'full' })
  useFakeStorage(group)

  const JPEG = (label: string) => ({
    content: Buffer.from(`jpeg ${label}`),
    mimeType: 'image/jpeg',
  })
  const URL_A = 'https://images.fixture.example/a.jpg'
  const URL_B = 'https://images.fixture.example/b.jpg'
  const URL_C = 'https://images.fixture.example/c.jpg'
  const STORE = { ...OPTIONS, storeImages: true }

  let http: FakeSupplierHttpClient
  group.each.setup(() => {
    http = new FakeSupplierHttpClient({}, { [URL_A]: JPEG('a'), [URL_B]: JPEG('b') })
    app.container.swap(SupplierHttpClient, () => http)
    return () => app.container.restore(SupplierHttpClient)
  })

  const withImages = (...urls: string[]) =>
    normalizedProduct({
      images: urls.map((url, index) => ({ url, role: index === 0 ? 'primary' : 'view' })),
    })

  async function gallery() {
    const product = await Product.findByOrFail('externalId', 'EXT-1')
    return ProductImage.query().where('productId', product.id).orderBy('position')
  }

  test('images déjà copiées : réutilisées sans re-téléchargement', async ({ assert }) => {
    await runImport(new InMemorySupplierConnector([withImages(URL_A, URL_B)]), STORE)
    const before = await gallery()
    assert.deepEqual(
      before.map((image) => image.sourceUrl),
      [URL_A, URL_B]
    )
    assert.isTrue(before.every((image) => image.storageObjectId !== null))
    assert.lengthOf(http.downloads, 2)

    http.downloads = []
    await runImport(new InMemorySupplierConnector([withImages(URL_A, URL_B)]), STORE)
    assert.lengthOf(http.downloads, 0)
    const after = await gallery()
    assert.deepEqual(
      after.map((image) => image.id),
      before.map((image) => image.id)
    )
  })

  test('téléchargement en échec : galerie existante intacte', async ({ assert }) => {
    await runImport(new InMemorySupplierConnector([withImages(URL_A, URL_B)]), STORE)
    const before = await gallery()

    // URL_C injoignable (503) : la galerie n'est ni amputée ni remplacée.
    const summary = await runImport(
      new InMemorySupplierConnector([withImages(URL_A, URL_B, URL_C)]),
      STORE
    )
    assert.include(summary, { updated: 1, failed: 0 })
    const after = await gallery()
    assert.deepEqual(
      after.map((image) => [image.id, image.storageObjectId]),
      before.map((image) => [image.id, image.storageObjectId])
    )
  })
})
