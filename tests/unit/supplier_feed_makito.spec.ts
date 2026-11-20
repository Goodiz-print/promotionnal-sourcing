import { test } from '@japa/runner'
import {
  buildMakitoIndex,
  indexMakitoAreaLabels,
  indexMakitoCategories,
  indexMakitoColors,
  indexMakitoDescriptions,
  indexMakitoImages,
  indexMakitoKeywords,
  indexMakitoLeadTimes,
  indexMakitoMarkings,
  indexMakitoPrices,
  indexMakitoSheets,
  indexMakitoStock,
  indexMakitoTechniqueLabels,
  indexMakitoTechniquePrices,
  indexMakitoVariants,
  keptRef,
  makitoDescription,
  makitoImage,
  makitoKeywords,
  makitoMarkingRow,
  makitoProductsPage,
  singlePrimaryImage,
} from '#services/supplier_feed/makito_feed_index'
import {
  makitoLifecycle,
  makitoMarkingPositions,
  makitoPackaging,
  makitoProductName,
  makitoTechnique,
  makitoVariant,
  makitoVariants,
  normalizeMakitoProduct,
  sortMakitoImages,
} from '#services/supplier_feed/makito_feed_mapper'
import type { MakitoCatalogueIndex, MakitoMarkingRow } from '#shared/types/supplier_feed'

const REFS = new Set(['1000', '2000'])
const emptyIndex = (): MakitoCatalogueIndex => buildMakitoIndex(REFS, {} as never)
const marking = (overrides: Partial<MakitoMarkingRow> = {}): MakitoMarkingRow => ({
  areaId: '10',
  techniqueRef: 'T1',
  maxColors: 1,
  widthMm: 50,
  heightMm: 20,
  ...overrides,
})

test.group('Makito — index des flux annexes', () => {
  test('keptRef : seules les fiches retenues', ({ assert }) => {
    assert.equal(keptRef({ ref: '1000' }, REFS), '1000')
    assert.equal(keptRef({ ref: 1000 }, REFS), '1000')
    assert.isNull(keptRef({ ref: '9999' }, REFS))
    assert.isNull(keptRef({}, REFS))
  })

  test('makitoProductsPage : fiches et pagination, tolérant à une réponse vide', ({ assert }) => {
    assert.deepEqual(
      makitoProductsPage({
        products: [{ ref: '1000', name: 'Betty' }],
        page_info: { last_page: '3', total: 2500 },
      }),
      { products: [{ ref: '1000', name: 'Betty' }], lastPage: 3, total: 2500 }
    )
    assert.deepEqual(makitoProductsPage(null), { products: [], lastPage: null, total: null })
  })

  test('indexMakitoSheets : fiche descriptive des refs retenues', ({ assert }) => {
    const sheets = indexMakitoSheets(
      [
        { ref: '1000', type: 'Foulard' },
        { ref: '9999', type: 'Sac' },
      ],
      REFS
    )
    assert.deepEqual([...sheets.keys()], ['1000'])
  })

  test('makitoDescription : desc puis commercial_desc, sans balise', ({ assert }) => {
    assert.equal(
      makitoDescription({ desc: '<p>Doux</p>', commercial_desc: 'Idéal en été' }),
      'Doux\n\nIdéal en été'
    )
    assert.equal(makitoDescription({ desc: 'Doux', commercial_desc: '' }), 'Doux')
    assert.isNull(makitoDescription({ desc: '<br>' }))
    assert.deepEqual(
      [
        ...indexMakitoDescriptions(
          [
            { ref: '1000', desc: '' },
            { ref: '2000', desc: 'Net' },
          ],
          REFS
        ),
      ],
      [['2000', 'Net']]
    )
  })

  test('makitoKeywords : toutes langues, découpés et dédoublonnés', ({ assert }) => {
    assert.deepEqual(makitoKeywords({ 4: 'foulard, soie', 2: 'scarf,foulard, ' }), [
      'scarf',
      'foulard',
      'soie',
    ])
    assert.isNull(makitoKeywords('foulard'))
    assert.isNull(makitoKeywords(null))
  })

  test('indexMakitoKeywords : objet par ref, flux illisible → vide', ({ assert }) => {
    const keywords = indexMakitoKeywords(
      { keywords: { '1000': { 4: 'foulard' }, '9999': { 4: 'sac' }, '2000': 'illisible' } },
      REFS
    )
    assert.deepEqual([...keywords], [['1000', ['foulard']]])
    assert.equal(indexMakitoKeywords('panne', REFS).size, 0)
    assert.equal(indexMakitoKeywords(null, REFS).size, 0)
  })

  test('indexMakitoCategories et indexMakitoVariants : regroupés par ref', ({ assert }) => {
    const categories = indexMakitoCategories(
      [
        { ref: '1000', category: 'Textile' },
        { ref: '1000', category: 'Nouveautés' },
        { ref: '1000', category: '' },
        { ref: '9999', category: 'Sacs' },
      ],
      REFS
    )
    assert.deepEqual([...categories], [['1000', ['Textile', 'Nouveautés']]])

    const variants = indexMakitoVariants(
      [
        { matnr: '1000-01', ref: '1000' },
        { matnr: '1000-02', ref: '1000' },
        { matnr: '9999-01', ref: '9999' },
      ],
      REFS
    )
    assert.lengthOf(variants.get('1000') ?? [], 2)
    assert.isFalse(variants.has('9999'))
  })

  test('indexMakitoColors : libellé par code', ({ assert }) => {
    const colors = indexMakitoColors([
      { color_code: '01', name: 'Blanc' },
      { color_code: '02', name: '' },
    ])
    assert.deepEqual([...colors], [['01', 'Blanc']])
  })

  test('indexMakitoStock : stock immédiat additionné, points de milliers lus', ({ assert }) => {
    const stock = indexMakitoStock(
      [
        { ref: '1000', matnr: '1000-01', stock: '24.000', stock_availability: 'immediately' },
        { ref: '1000', matnr: '1000-01', stock: '500', stock_availability: 'immediately' },
        { ref: '1000', matnr: '1000-01', stock: '9.000', stock_availability: '2026-12-01' },
        { ref: '1000', matnr: '1000-02', stock: '1.5', stock_availability: 'immediately' },
        { ref: '9999', matnr: '9999-01', stock: '10', stock_availability: 'immediately' },
      ],
      REFS
    )
    assert.deepEqual([...stock], [['1000-01', 24500]])
  })

  test('indexMakitoPrices : section_n = seuil bas', ({ assert }) => {
    const prices = indexMakitoPrices(
      [{ ref: '1000', section_1: -500, price_1: 1.2, section_2: 500, price_2: 1 }],
      REFS
    )
    assert.deepEqual(prices.get('1000'), [
      { minQuantity: 1, unitPrice: 1.2 },
      { minQuantity: 500, unitPrice: 1 },
    ])
  })

  test('makitoImage : rôle d’après le dossier, main = principale', ({ assert }) => {
    const base = 'https://img.example'
    assert.deepEqual(makitoImage({ url: `${base}/principal/a.jpg` }), {
      url: `${base}/principal/a.jpg`,
      role: 'primary',
    })
    assert.equal(makitoImage({ url: `${base}/bodegones/a.jpg` })?.role, 'lifestyle')
    assert.equal(makitoImage({ url: `${base}/detalles/a.jpg`, main: '1' })?.role, 'primary')
    // Dossiers ignorés (déclinaisons, cartons) et URL invalides.
    assert.isNull(makitoImage({ url: `${base}/variantes/a.jpg` }))
    assert.isNull(makitoImage({ url: 'principal/a.jpg' }))
  })

  test('singlePrimaryImage et indexMakitoImages : une seule principale par fiche', ({ assert }) => {
    assert.deepEqual(
      singlePrimaryImage([
        { url: 'a', role: 'view' },
        { url: 'b', role: 'primary' },
        { url: 'c', role: 'primary' },
      ]).map((image) => image.role),
      ['view', 'primary', 'view']
    )
    const images = indexMakitoImages(
      [
        { ref: '1000', url: 'https://img.example/principal/a.jpg' },
        { ref: '1000', url: 'https://img.example/principal/b.jpg' },
        { ref: '1000', url: 'https://img.example/cajas/c.jpg' },
        { ref: '9999', url: 'https://img.example/principal/z.jpg' },
      ],
      REFS
    )
    assert.deepEqual(
      images.get('1000')?.map((image) => image.role),
      ['primary', 'view']
    )
    assert.equal(images.size, 1)
  })

  test('makitoMarkingRow et indexMakitoMarkings : surface en mm, lignes incomplètes écartées', ({
    assert,
  }) => {
    const row = {
      ref: '1000',
      print_area_id: 10,
      technique_ref: 'T1',
      max_colors: '2',
      width: 5,
      height: '2,5',
    }
    assert.deepEqual(makitoMarkingRow(row), {
      areaId: '10',
      techniqueRef: 'T1',
      maxColors: 2,
      widthMm: 50,
      heightMm: 25,
    })
    assert.isNull(makitoMarkingRow({ print_area_id: 10 }))
    const markings = indexMakitoMarkings(
      [row, { ref: '1000', print_area_id: '', technique_ref: 'T2' }, { ...row, ref: '9999' }],
      REFS
    )
    assert.lengthOf(markings.get('1000') ?? [], 1)
    assert.equal(markings.size, 1)
  })

  test('libellés de zone et de technique : sans balise, premier libellé de technique gardé', ({
    assert,
  }) => {
    assert.deepEqual(
      [...indexMakitoAreaLabels([{ print_area_id: 10, txt: 'Face 20 cm<sup>2</sup>' }])],
      [['10', 'Face 20 cm2']]
    )
    const labels = indexMakitoTechniqueLabels([
      { technique_ref: 'T1', name: 'Sérigraphie' },
      { technique_ref: 'T1', name: 'Sérigraphie (bis)' },
      { technique_ref: 'T2', name: '' },
    ])
    assert.deepEqual([...labels], [['T1', 'Sérigraphie']])
  })

  test('indexMakitoTechniquePrices : cliché nul ignoré, section_n = borne haute', ({ assert }) => {
    const prices = indexMakitoTechniquePrices([
      {
        technique_ref: 'T1',
        cliche: '25',
        section_1: 250,
        price_1: 0.3,
        section_2: 500,
        price_2: 0.2,
      },
      { technique_ref: 'T2', cliche: 0, section_1: 100, price_1: 1 },
    ])
    assert.deepEqual(prices.get('T1'), {
      setupCharge: 25,
      tiers: [
        { minQuantity: 1, unitPrice: 0.3 },
        { minQuantity: 251, unitPrice: 0.2 },
      ],
    })
    assert.isNull(prices.get('T2')?.setupCharge)
  })

  test('indexMakitoLeadTimes : plus court délai export en jours', ({ assert }) => {
    const leadTimes = indexMakitoLeadTimes([
      { material: 'T1', printing_lead_time: 7, zone_code: 'EXP', unit: 'D' },
      { material: 'T1', printing_lead_time: 5, zone_code: 'EXP', unit: 'D' },
      { material: 'T1', printing_lead_time: 2, zone_code: 'PEN', unit: 'D' },
      { material: 'T2', printing_lead_time: 48, zone_code: 'EXP', unit: 'H' },
    ])
    assert.deepEqual([...leadTimes], [['T1', 5]])
  })

  test('buildMakitoIndex : flux absents → index vides', ({ assert }) => {
    assert.deepEqual(
      Object.values(emptyIndex()).map((map) => map.size),
      Array.from({ length: 14 }, () => 0)
    )
  })
})

test.group('Makito — traduction des fiches', () => {
  test('makitoLifecycle : rubriques marketing des 4 langues', ({ assert }) => {
    assert.equal(makitoLifecycle(['Textile', 'Nouveautés 2026']), 'new')
    assert.equal(makitoLifecycle(['Neuheiten']), 'new')
    assert.equal(makitoLifecycle(['Outlet', 'Novedades']), 'end_of_series')
    assert.equal(makitoLifecycle(['Déstockage']), 'end_of_series')
    assert.equal(makitoLifecycle(['Textile']), 'active')
    assert.equal(makitoLifecycle([]), 'active')
  })

  test('makitoProductName : type d’article en préfixe, sauf s’il y est déjà', ({ assert }) => {
    assert.equal(makitoProductName('Betty', 'Foulard'), 'Foulard Betty')
    assert.equal(makitoProductName('Foulard Betty', 'foulard'), 'Foulard Betty')
    assert.equal(makitoProductName('Betty', null), 'Betty')
  })

  test('sortMakitoImages : principale, ambiance, vues', ({ assert }) => {
    const images = sortMakitoImages([
      { url: 'v', role: 'view' },
      { url: 'l', role: 'lifestyle' },
      { url: 'p', role: 'primary' },
    ])
    assert.deepEqual(
      images.map((image) => image.url),
      ['p', 'l', 'v']
    )
  })

  test('makitoVariant : couleur traduite et taille, « S/T » ignorée', ({ assert }) => {
    const index = { colors: new Map([['01', 'Blanc']]), stock: new Map([['1000-01-M', 12]]) }
    assert.deepEqual(
      makitoVariant(
        { matnr: '1000-01-M', color: '01', size: 'M', img100: 'https://img.example/v.jpg' },
        '1000',
        index
      ),
      {
        sku: '1000-01-M',
        colorLabel: 'Blanc / M',
        gtin: null,
        stockQuantity: 12,
        priceTiers: [],
        images: [{ url: 'https://img.example/v.jpg', role: 'view' }],
      }
    )
    const plain = makitoVariant({ matnr: '1000-99', color: '99', size: 'S/T' }, '1000', index)
    // Code couleur inconnu : gardé tel quel.
    assert.equal(plain.colorLabel, '99')
    assert.isNull(plain.stockQuantity)
    assert.deepEqual(plain.images, [])
    assert.isNull(makitoVariant({}, '1000', index).colorLabel)
  })

  test('makitoVariants : sans déclinaison, la fiche seule', ({ assert }) => {
    const index = emptyIndex()
    assert.deepEqual(makitoVariants('1000', index), [
      {
        sku: '1000',
        colorLabel: null,
        gtin: null,
        stockQuantity: null,
        priceTiers: [],
        images: [],
      },
    ])
    index.variants.set('1000', [{ matnr: '1000-01' }, { matnr: '1000-02' }])
    assert.deepEqual(
      makitoVariants('1000', index).map((variant) => variant.sku),
      ['1000-01', '1000-02']
    )
  })

  test('makitoTechnique : prix joints, null sans libellé connu', ({ assert }) => {
    const index = {
      techniqueLabels: new Map([['T1', 'Sérigraphie']]),
      techniquePrices: new Map([
        ['T1', { setupCharge: 25, tiers: [{ minQuantity: 1, unitPrice: 0.3 }] }],
      ]),
    }
    assert.deepEqual(makitoTechnique(marking({ maxColors: 3 }), index), {
      label: 'Sérigraphie',
      maxColors: 3,
      setupCharge: 25,
      priceTiers: [{ minQuantity: 1, unitPrice: 0.3 }],
    })
    assert.isNull(makitoTechnique(marking({ techniqueRef: 'T9' }), index))
  })

  test('makitoMarkingPositions : une zone = une position, plus grande surface', ({ assert }) => {
    const index = {
      areaLabels: new Map([['10', 'Face']]),
      techniqueLabels: new Map([
        ['T1', 'Sérigraphie'],
        ['T2', 'Transfert'],
      ]),
      techniquePrices: new Map(),
    }
    const positions = makitoMarkingPositions(
      [
        marking(),
        marking({ techniqueRef: 'T2', widthMm: 80, heightMm: null }),
        marking({ areaId: '20', techniqueRef: 'T1', widthMm: null, heightMm: null }),
        // Zone dont aucune technique n'a de libellé : écartée.
        marking({ areaId: '30', techniqueRef: 'T9' }),
      ],
      index
    )
    assert.deepEqual(
      positions.map((position) => [
        position.name,
        position.maxWidthMm,
        position.maxHeightMm,
        position.techniques.map((technique) => technique.label),
      ]),
      [
        ['Face', 80, 20, ['Sérigraphie', 'Transfert']],
        ['Zone 20', null, null, ['Sérigraphie']],
      ]
    )
  })

  test('makitoPackaging : carton maître, faute de frappe « ptc_wight » de l’API', ({ assert }) => {
    assert.deepEqual(
      makitoPackaging({
        weight: 35,
        ptc_units: '200',
        ptc_length: 50,
        ptc_width: '40,5',
        ptc_height: 30,
        ptc_wight: '7,2',
      }),
      {
        packageType: null,
        unitGrossWeightG: 35,
        outerCartonQty: 200,
        outerCartonLengthMm: 500,
        outerCartonWidthMm: 405,
        outerCartonHeightMm: 300,
        outerCartonGrossWeightG: 7200,
      }
    )
    assert.equal(makitoPackaging({ ptc_weight: 1 }).outerCartonGrossWeightG, 1000)
  })

  test('normalizeMakitoProduct : fiche assemblée depuis l’index', ({ assert }) => {
    const index = buildMakitoIndex(REFS, {
      sheets: [{ ref: '1000', type: 'Foulard', comp: 'Polyester', info: 'Lavable' }],
      descriptions: [{ ref: '1000', desc: 'Doux' }],
      keywords: { keywords: { '1000': { 4: 'foulard' } } },
      categories: [{ ref: '1000', category: 'Nouveautés' }],
      variants: [{ ref: '1000', matnr: '1000-01', color: '01', size: 'S/T' }],
      colors: [{ color_code: '01', name: 'Blanc' }],
      stock: [{ ref: '1000', matnr: '1000-01', stock: '10', stock_availability: 'immediately' }],
      prices: [{ ref: '1000', section_1: -500, price_1: 1.2 }],
      images: [
        { ref: '1000', url: 'https://img.example/detalles/d.jpg' },
        { ref: '1000', url: 'https://img.example/principal/p.jpg' },
      ],
      markings: [{ ref: '1000', print_area_id: 10, technique_ref: 'T1', width: 5, height: 2 }],
      areaLabels: [{ print_area_id: 10, txt: 'Face' }],
      techniqueLabels: [{ technique_ref: 'T1', name: 'Sérigraphie' }],
      techniquePrices: [{ technique_ref: 'T1', cliche: 25, section_1: 250, price_1: 0.3 }],
      leadTimes: [{ material: 'T1', printing_lead_time: 6, zone_code: 'EXP', unit: 'D' }],
    })
    const product = normalizeMakitoProduct(
      { ref: '1000', name: 'Betty', intrastat: '621410000000', country_of_origin: 'China' },
      index
    )

    assert.equal(product.externalId, '1000')
    assert.equal(product.name, 'Foulard Betty')
    assert.equal(product.description, 'Doux\n\nLavable')
    assert.deepEqual(product.keywords, ['foulard'])
    assert.equal(product.hsCode, '6214100000')
    assert.equal(product.originCountry, 'CN')
    assert.equal(product.categoryRaw, 'Nouveautés')
    assert.deepEqual(product.materialLabels, ['Polyester'])
    assert.equal(product.lifecycleStatus, 'new')
    assert.equal(product.leadTimeDays, 6)
    assert.deepEqual(product.priceTiers, [{ minQuantity: 1, unitPrice: 1.2 }])
    assert.deepEqual(
      product.variants.map((variant) => [variant.sku, variant.colorLabel, variant.stockQuantity]),
      [['1000-01', 'Blanc', 10]]
    )
    assert.deepEqual(
      product.images.map((image) => image.role),
      ['primary', 'view']
    )
    assert.deepEqual(product.markingPositions, [
      {
        name: 'Face',
        maxWidthMm: 50,
        maxHeightMm: 20,
        techniques: [
          {
            label: 'Sérigraphie',
            maxColors: null,
            setupCharge: 25,
            priceTiers: [{ minQuantity: 1, unitPrice: 0.3 }],
          },
        ],
      },
    ])
  })

  test('normalizeMakitoProduct : fiche nue, valeurs de repli', ({ assert }) => {
    const product = normalizeMakitoProduct({ ref: '2000' }, emptyIndex())
    assert.equal(product.name, '2000')
    assert.isNull(product.description)
    assert.isNull(product.categoryRaw)
    assert.isNull(product.leadTimeDays)
    assert.equal(product.lifecycleStatus, 'active')
    assert.deepEqual(
      product.variants.map((variant) => variant.sku),
      ['2000']
    )
    assert.deepEqual(product.markingPositions, [])
  })
})
