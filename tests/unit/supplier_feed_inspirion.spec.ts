import { test } from '@japa/runner'
import {
  buildInspirionIndex,
  indexInspirionCategories,
  indexInspirionDeliveryTimes,
  indexInspirionPrices,
  indexInspirionPrintData,
  indexInspirionPrintPrices,
  indexInspirionStock,
  inspirionCategoryLabel,
  inspirionPriceTiers,
} from '#services/supplier_feed/inspirion_feed_index'
import {
  inspirionImages,
  inspirionMarkingPosition,
  inspirionMarkingPositions,
  inspirionPackaging,
  inspirionPrintAreaMm,
  inspirionPrintMethod,
  inspirionVariant,
  normalizeInspirionProduct,
} from '#services/supplier_feed/inspirion_feed_mapper'
import type { InspirionCatalogueIndex } from '#shared/types/supplier_feed'

const emptyIndex = (): InspirionCatalogueIndex => buildInspirionIndex({} as never)

test.group('Inspirion — index des flux annexes', () => {
  test('inspirionPriceTiers : triés, prix nuls et quantités invalides écartés', ({ assert }) => {
    const tiers = inspirionPriceTiers(
      [
        { bulk_volume: 500, price: '1,10' },
        { bulk_volume: 100, price: 1.5 },
        { bulk_volume: 1000, price: 0 },
        { bulk_volume: 0, price: 2 },
        { price: 3 },
      ],
      'bulk_volume'
    )
    assert.deepEqual(tiers, [
      { minQuantity: 100, unitPrice: 1.5 },
      { minQuantity: 500, unitPrice: 1.1 },
    ])
  })

  test('indexInspirionPrices : paliers et devise par article, EUR par défaut', ({ assert }) => {
    const prices = indexInspirionPrices([
      { article_id: 'A-1', pricelist: [{ bulk_volume: 50, price: 2, currency: 'PLN' }] },
      { article_id: 'A-2', pricelist: [] },
      { article_id: '', pricelist: [{ bulk_volume: 1, price: 9 }] },
    ])
    assert.deepEqual(prices.get('A-1'), {
      currency: 'PLN',
      tiers: [{ minQuantity: 50, unitPrice: 2 }],
    })
    assert.deepEqual(prices.get('A-2'), { currency: 'EUR', tiers: [] })
    assert.equal(prices.size, 2)
  })

  test('indexInspirionStock : stock France, jamais négatif, illisible écarté', ({ assert }) => {
    const stock = indexInspirionStock({
      data: [
        { article_id: 'A-1', stock_france: '120' },
        { article_id: 'A-2', stock_france: -4 },
        { article_id: 'A-3', stock_france: 'n/a' },
      ],
    })
    assert.deepEqual(
      [...stock],
      [
        ['A-1', 120],
        ['A-2', 0],
      ]
    )
  })

  test('inspirionCategoryLabel : « parent > rubrique », libellé brut en repli', ({ assert }) => {
    assert.equal(
      inspirionCategoryLabel({
        parent_category_translation: 'Bureau',
        category_translation: 'Stylos',
        category: 'pens',
      }),
      'Bureau > Stylos'
    )
    assert.equal(inspirionCategoryLabel({ category: 'pens' }), 'pens')
    assert.isNull(inspirionCategoryLabel({ category: '' }))
  })

  test('indexInspirionCategories : rubriques dédoublonnées par article', ({ assert }) => {
    const categories = indexInspirionCategories([
      {
        articleId: 'A-1',
        categories: [
          { category: 'pens', category_translation: 'Stylos' },
          { category: 'pens', category_translation: 'Stylos' },
          { category: 'eco', parent_category_translation: 'Sélections' },
        ],
      },
    ])
    assert.deepEqual(categories.get('A-1'), ['Stylos', 'Sélections > eco'])
  })

  test('indexInspirionPrintData : nœud printdata par article', ({ assert }) => {
    const node = { article_id: 'A-1', print_positions: [] }
    const printData = indexInspirionPrintData([node, { article_id: null, print_positions: [] }])
    assert.deepEqual([...printData], [['A-1', node]])
  })

  test('indexInspirionPrintPrices : frais fixes et paliers par code', ({ assert }) => {
    const prices = indexInspirionPrintPrices([
      {
        printcode: 'T1',
        setup: '35,00',
        pricelist: [
          { quantity: 250, price: 0.4 },
          { quantity: 50, price: 0.6 },
        ],
      },
    ])
    assert.deepEqual(prices.get('T1'), {
      setupCharge: 35,
      tiers: [
        { minQuantity: 50, unitPrice: 0.6 },
        { minQuantity: 250, unitPrice: 0.4 },
      ],
    })
  })

  test('indexInspirionDeliveryTimes : plus court avec marquage, sans marquage en repli', ({
    assert,
  }) => {
    const times = indexInspirionDeliveryTimes([
      { article_id: 'A-1', delivery_days: 3 },
      { article_id: 'A-1', delivery_days: 12, print_code: 'T1' },
      { article_id: 'A-1', delivery_days: 8, print_code: 'T2' },
      { article_id: 'A-2', delivery_days: 5 },
      { article_id: 'A-2', delivery_days: 4 },
      { article_id: 'A-3', delivery_days: 0, print_code: 'T1' },
    ])
    assert.equal(times.get('A-1'), 8)
    assert.equal(times.get('A-2'), 4)
    assert.isFalse(times.has('A-3'))
  })

  test('buildInspirionIndex : flux absents → index vides', ({ assert }) => {
    const index = emptyIndex()
    assert.deepEqual(
      Object.values(index).map((map) => map.size),
      [0, 0, 0, 0, 0, 0]
    )
  })
})

test.group('Inspirion — traduction des fiches', () => {
  test('inspirionImages : liste préférée, repli si vide, URL invalides écartées', ({ assert }) => {
    const fallback = [{ image_url: 'https://img.example/a.jpg' }, { image_url: 'ftp://x' }]
    assert.deepEqual(inspirionImages([], fallback, 'primary'), [
      { url: 'https://img.example/a.jpg', role: 'primary' },
    ])
    assert.deepEqual(
      inspirionImages(
        [{ image_url: 'https://img.example/1.jpg' }, { image_url: 'https://img.example/2.jpg' }],
        fallback,
        'primary'
      ).map((image) => image.role),
      ['primary', 'view']
    )
  })

  test('inspirionVariant : couleur, EAN, stock et prix joints, une seule image', ({ assert }) => {
    const index = emptyIndex()
    index.stock.set('A-1', 40)
    index.prices.set('A-1', { currency: 'EUR', tiers: [{ minQuantity: 1, unitPrice: 2 }] })
    const variant = inspirionVariant(
      {
        article_id: 'A-1',
        colour: 'Bleu',
        ean: '4000000000001',
        images: [
          { image_url: 'https://img.example/1.jpg' },
          { image_url: 'https://img.example/2.jpg' },
        ],
      },
      'SKU',
      index
    )
    assert.deepEqual(variant, {
      sku: 'A-1',
      colorLabel: 'Bleu',
      gtin: '4000000000001',
      stockQuantity: 40,
      priceTiers: [{ minQuantity: 1, unitPrice: 2 }],
      images: [{ url: 'https://img.example/1.jpg', role: 'view' }],
    })
    // Article sans identifiant ni flux annexe : repli sur le sku de la fiche.
    assert.deepEqual(inspirionVariant({}, 'SKU', index), {
      sku: 'SKU',
      colorLabel: null,
      gtin: null,
      stockQuantity: null,
      priceTiers: [],
      images: [],
    })
  })

  test('inspirionPackaging : unités annoncées converties, carton en kg par défaut', ({
    assert,
  }) => {
    assert.deepEqual(
      inspirionPackaging({
        weight: { net: 15, gross: 18, unit: 'g' },
        pu: {
          pu: 100,
          length: 40,
          length_unit: 'cm',
          width: 300,
          width_unit: 'mm',
          height: 20,
          gross_weight: '2,5',
        },
      }),
      {
        packageType: null,
        unitGrossWeightG: 18,
        outerCartonQty: 100,
        outerCartonLengthMm: 400,
        outerCartonWidthMm: 300,
        outerCartonHeightMm: 200,
        outerCartonGrossWeightG: 2500,
      }
    )
    assert.isNull(inspirionPackaging({}).outerCartonQty)
  })

  test('inspirionPrintAreaMm : plus grande surface, diamètre pour une surface ronde', ({
    assert,
  }) => {
    const areas = [
      { width_bottom: 5, width_unit: 'cm', height: 20, height_unit: 'mm' },
      { diameter: 60, diameter_unit: 'mm' },
    ]
    assert.equal(inspirionPrintAreaMm(areas, 'width'), 60)
    assert.equal(inspirionPrintAreaMm(areas, 'height'), 60)
    assert.isNull(inspirionPrintAreaMm([{}], 'width'))
    assert.isNull(inspirionPrintAreaMm([], 'height'))
  })

  test('inspirionPrintMethod : code par défaut, sinon le premier ; null sans libellé', ({
    assert,
  }) => {
    const printPrices = indexInspirionPrintPrices([
      { printcode: 'T2', setup: 30, pricelist: [{ quantity: 50, price: 0.5 }] },
    ])
    const method = {
      print_method_name: 'Tampographie',
      print_codes: [
        { print_code: 'T1', max_colours: 1, print_area: { height: 10 } },
        { print_code: 'T2', max_colours: 4, default: true, print_area: { height: 20 } },
      ],
    }
    assert.deepEqual(inspirionPrintMethod(method, printPrices), {
      areas: [{ height: 10 }, { height: 20 }],
      technique: {
        label: 'Tampographie',
        maxColors: 4,
        setupCharge: 30,
        priceTiers: [{ minQuantity: 50, unitPrice: 0.5 }],
      },
    })
    const first = inspirionPrintMethod(
      { print_method_name: 'Laser', print_codes: [{ print_code: 'L1' }] },
      printPrices
    )
    assert.deepEqual(first?.technique, {
      label: 'Laser',
      maxColors: null,
      setupCharge: null,
      priceTiers: [],
    })
    assert.isNull(inspirionPrintMethod({ print_codes: [{ print_code: 'L1' }] }, printPrices))
    assert.isNull(
      inspirionPrintMethod({ print_method_name: 'Laser', print_codes: [] }, printPrices)
    )
  })

  test('inspirionMarkingPosition(s) : positions sans technique écartées', ({ assert }) => {
    const usable = {
      position_name: 'Corps',
      print_methods: [
        {
          print_method_name: 'Laser',
          print_codes: [{ print_code: 'L1', print_area: { width_bottom: 4, height: 1 } }],
        },
      ],
    }
    const unusable = { position_name: 'Clip', print_methods: [{ print_codes: [] }] }

    assert.deepInclude(inspirionMarkingPosition(usable, new Map()), {
      name: 'Corps',
      maxWidthMm: 40,
      maxHeightMm: 10,
    })
    assert.isNull(inspirionMarkingPosition(unusable, new Map()))
    assert.deepEqual(
      inspirionMarkingPositions({ print_positions: [usable, unusable] }, new Map()).map(
        (position) => position.name
      ),
      ['Corps']
    )
  })

  test('normalizeInspirionProduct : fiche assemblée depuis ses articles et l’index', ({
    assert,
  }) => {
    const index = buildInspirionIndex({
      prices: [
        { article_id: 'A-1', pricelist: [{ bulk_volume: 100, price: 2 }] },
        { article_id: 'A-2', pricelist: [{ bulk_volume: 100, price: 1.8 }] },
      ],
      stock: [{ article_id: 'A-2', stock_france: 7 }],
      categories: [
        { articleId: 'A-1', categories: [{ category: 'Stylos' }] },
        { articleId: 'A-2', categories: [{ category: 'Stylos' }, { category: 'Eco' }] },
      ],
      printData: [{ article_id: 'A-2', print_positions: [] }],
      printPrices: [],
      deliveryTimes: [
        { article_id: 'A-1', delivery_days: 9 },
        { article_id: 'A-2', delivery_days: 6 },
      ],
    })
    const product = normalizeInspirionProduct(
      {
        sku: 'SKU-1',
        name: 'Stylo',
        description: '<b>Stylo</b> bille',
        keywords: ['stylo', ' ', 'bille'],
        materials: 'ABS',
        commodity_code: '9608 10 10 00 99',
        origin_country: 'China',
        variants: [
          { article_id: 'A-1', images: [{ image_url: 'https://img.example/a1.jpg' }] },
          { article_id: 'A-2' },
        ],
        details_images: [{ image_url: 'https://img.example/detail.jpg' }],
      },
      index
    )

    assert.equal(product.externalId, 'SKU-1')
    assert.equal(product.description, 'Stylo bille')
    assert.deepEqual(product.keywords, ['stylo', 'bille'])
    assert.deepEqual(product.materialLabels, ['ABS'])
    assert.equal(product.hsCode, '9608101000')
    assert.equal(product.originCountry, 'CN')
    assert.equal(product.categoryRaw, 'Stylos | Eco')
    assert.equal(product.leadTimeDays, 6)
    // Grille de la déclinaison la moins chère.
    assert.deepEqual(product.priceTiers, [{ minQuantity: 100, unitPrice: 1.8 }])
    assert.deepEqual(
      product.variants.map((variant) => [variant.sku, variant.stockQuantity]),
      [
        ['A-1', null],
        ['A-2', 7],
      ]
    )
    assert.deepEqual(product.images, [
      { url: 'https://img.example/a1.jpg', role: 'primary' },
      { url: 'https://img.example/detail.jpg', role: 'view' },
    ])
    assert.deepEqual(product.markingPositions, [])
  })

  test('normalizeInspirionProduct : fiche nue, valeurs de repli', ({ assert }) => {
    const product = normalizeInspirionProduct({ sku: 'SKU-2' }, emptyIndex())
    assert.equal(product.name, 'SKU-2')
    assert.equal(product.currency, 'EUR')
    assert.isNull(product.categoryRaw)
    assert.isNull(product.leadTimeDays)
    assert.deepEqual(product.variants, [])
    assert.deepEqual(product.priceTiers, [])
  })
})
