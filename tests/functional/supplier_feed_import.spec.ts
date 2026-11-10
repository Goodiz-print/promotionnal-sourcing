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
import SupplierCatalogueImporter from '#services/supplier_feed/supplier_catalogue_importer'
import SupplierConnectorRegistry from '#services/supplier_feed/supplier_connector_registry'
import { FALLBACK_CATEGORY_SLUG } from '#services/supplier_feed/supplier_reference_service'
import { UnknownSupplierConnectorException } from '#exceptions/supplier_feed_errors'
import { useDatabase } from '#tests/utils/setup'
import { InMemorySupplierConnector, normalizedProduct } from '#tests/utils/supplier_feed'
import type { SupplierImportOptions } from '#shared/types/supplier_feed'

const OPTIONS: SupplierImportOptions = {
  limit: 200,
  locale: 'fr',
  dryRun: false,
  storeImages: false,
  skipImages: false,
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

  /** Import via le conteneur (dépendances réelles), sur un connecteur en mémoire. */
  async function runImport(connector: InMemorySupplierConnector, options = OPTIONS) {
    const importer = await app.container.make(SupplierCatalogueImporter)
    return importer.import(connector, options)
  }

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

  test('dry-run : bilan calculé, rien d’écrit', async ({ assert }) => {
    const summary = await runImport(new InMemorySupplierConnector([MARKED]), {
      ...OPTIONS,
      dryRun: true,
    })

    assert.include(summary, { fetched: 1, created: 0, updated: 0 })
    assert.isNull(await Supplier.findBy('slug', 'fixture-supplier'))
    assert.isNull(await Product.findBy('externalId', 'EXT-1'))
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
      ['pfconcept', 'passot', 'inspirion', 'axpol']
    )
    assert.throws(() => registry.get('acme'), UnknownSupplierConnectorException)
  })
})
