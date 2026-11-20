import { test } from '@japa/runner'
import PfConceptConnector from '#services/supplier_feed/pfconcept_connector'
import PassotConnector from '#services/supplier_feed/passot_connector'
import InspirionConnector from '#services/supplier_feed/inspirion_connector'
import MakitoConnector from '#services/supplier_feed/makito_connector'
import ReferenceMatcher from '#shared/helpers/reference_matcher'
import {
  SupplierConnectorNotConfiguredException,
  SupplierFeedHttpException,
} from '#exceptions/supplier_feed_errors'
import {
  cheapestPriceGrid,
  normalizeCountry,
  parseDecimal,
  parseGroupedInt,
  redactUrl,
  sectionPriceTiers,
} from '#shared/helpers/supplier_feed'
import {
  FakeSupplierHttpClient,
  supplierFixture,
  withSupplierCredentials,
} from '#tests/utils/supplier_feed'

/** Code factice : la vraie valeur ne vit que dans `.env`. */
const FAKE_FEED_CODE = 'aaaaaaaa_bbbb_cccc_dddd_eeeeeeeeeeee'

test.group('Flux fournisseurs — utilitaires', () => {
  test('parseDecimal accepte la virgule décimale et rejette le vide', ({ assert }) => {
    assert.equal(parseDecimal('17,5'), 17.5)
    assert.equal(parseDecimal(' 0.62 '), 0.62)
    assert.equal(parseDecimal(150), 150)
    assert.isNull(parseDecimal(''))
    assert.isNull(parseDecimal('n/a'))
    assert.isNull(parseDecimal(null))
  })

  test('parseGroupedInt lit les points de milliers', ({ assert }) => {
    assert.equal(parseGroupedInt('24.000'), 24000)
    assert.equal(parseGroupedInt('1.234.567'), 1234567)
    assert.equal(parseGroupedInt('26'), 26)
    assert.equal(parseGroupedInt(12), 12)
    assert.isNull(parseGroupedInt(''))
    assert.isNull(parseGroupedInt('n/a'))
  })

  test('sectionPriceTiers : seuils bas ou bornes hautes, colonnes vides ignorées', ({ assert }) => {
    const row = { section_1: 500, price_1: 0.8, section_2: 500, price_2: 0.7, section_3: 2000 }
    assert.deepEqual(
      sectionPriceTiers({ ...row, price_3: 0.6, section_4: 0, price_4: 0 }, 'from'),
      [
        { minQuantity: 1, unitPrice: 0.8 },
        { minQuantity: 500, unitPrice: 0.7 },
        { minQuantity: 2000, unitPrice: 0.6 },
      ]
    )
    // Borne haute répétée (500, 500) : le palier en double est écarté.
    assert.deepEqual(sectionPriceTiers({ ...row, price_3: '0,6' }, 'upTo'), [
      { minQuantity: 1, unitPrice: 0.8 },
      { minQuantity: 501, unitPrice: 0.6 },
    ])
    assert.deepEqual(sectionPriceTiers({ section_1: 100000, price_1: 0 }, 'upTo'), [])
  })

  test('redactUrl masque le code distributeur et la query string', ({ assert }) => {
    const url = `https://feeds.example/pricefeed_${FAKE_FEED_CODE}_v3.json?key=secret`
    const redacted = redactUrl(url)
    assert.notInclude(redacted, FAKE_FEED_CODE)
    assert.notInclude(redacted, 'secret')
    assert.equal(redacted, 'https://feeds.example/pricefeed_***_v3.json?***')
  })

  test('redactUrl masque un code de tout format, garde le code langue', ({ assert }) => {
    // Code avec tirets / lettres hors hexadécimal / court : masqué quand même.
    for (const code of ['3f2a9c1e-77b4-4d1a-9e0f-1b2c3d4e5f60', 'XYZ-42', 'abc']) {
      const redacted = redactUrl(`https://feeds.example/stockfeed_${code}_v3.json`)
      assert.notInclude(redacted, code)
    }
    assert.equal(
      redactUrl('https://feeds.example/productfeed_fr_v3.json'),
      'https://feeds.example/productfeed_fr_v3.json'
    )
    // Valeur exacte d'un secret configuré, où qu'elle apparaisse.
    assert.equal(
      redactUrl('https://api.example/v1/s3cr3t-token/items', ['s3cr3t-token']),
      'https://api.example/v1/***/items'
    )
  })

  test('cheapestPriceGrid garde une grille entière, jamais un mélange', ({ assert }) => {
    // Seuils différents : un minimum palier par palier donnerait 1:5, 50:3, 100:4.
    const grid = cheapestPriceGrid([
      [
        { minQuantity: 1, unitPrice: 5 },
        { minQuantity: 100, unitPrice: 4 },
      ],
      [{ minQuantity: 50, unitPrice: 3 }],
      [],
    ])
    assert.deepEqual(grid, [{ minQuantity: 50, unitPrice: 3 }])
    // Égalité au prix d'appel : la grille la moins chère en volume.
    assert.deepEqual(
      cheapestPriceGrid([
        [
          { minQuantity: 1, unitPrice: 2 },
          { minQuantity: 500, unitPrice: 1.8 },
        ],
        [
          { minQuantity: 500, unitPrice: 1.5 },
          { minQuantity: 1, unitPrice: 2 },
        ],
      ]),
      [
        { minQuantity: 1, unitPrice: 2 },
        { minQuantity: 500, unitPrice: 1.5 },
      ]
    )
    assert.deepEqual(cheapestPriceGrid([]), [])
  })

  test('normalizeCountry ramène les alias à l’ISO-2', ({ assert }) => {
    assert.equal(normalizeCountry('PRC'), 'CN')
    assert.equal(normalizeCountry('Chine'), 'CN')
    assert.equal(normalizeCountry('fr'), 'FR')
    assert.isNull(normalizeCountry('Atlantide'))
  })
})

test.group('Flux fournisseurs — rapprochement de référentiel', () => {
  const colors = new ReferenceMatcher([
    { id: 1, labels: ['bleu', 'blue'], priority: 0 },
    { id: 2, labels: ['bleu marine', 'navy'], priority: 1 },
    { id: 3, labels: ['rouge'], priority: 0 },
  ])

  test('le libellé le plus long l’emporte, insensible aux accents et à la casse', ({ assert }) => {
    assert.equal(colors.match('Bleu marine 02'), 2)
    assert.equal(colors.match('BLEU'), 1)
    assert.isNull(colors.match('Vert anis'))
    assert.isNull(colors.match(null))
  })

  test('mots entiers uniquement, pluriels simples tolérés', ({ assert }) => {
    const categories = new ReferenceMatcher([{ id: 7, labels: ['stylo'], priority: 0 }])
    assert.equal(categories.match('Stylos à bille'), 7)
    assert.isNull(categories.match('Stylographe'))
  })

  test('best additionne les libellés reconnus par entrée', ({ assert }) => {
    const categories = new ReferenceMatcher([
      { id: 10, labels: ['cuisine', 'tabliers'], priority: 1 },
      { id: 11, labels: ['maison', 'plaids'], priority: 1 },
    ])
    assert.equal(categories.best('Maison et cuisine > Couvertures Plaid polaire'), 11)
  })

  test('matchAll consomme les passages reconnus', ({ assert }) => {
    assert.deepEqual(colors.matchAll('Bleu marine / Rouge'), [2, 3])
  })
})

test.group('Connecteur PF Concept', (group) => {
  let restore: () => void = () => {}
  group.each.setup(() => {
    restore = withSupplierCredentials({ pfconceptFeedCode: FAKE_FEED_CODE })
    return () => restore()
  })

  const http = () =>
    new FakeSupplierHttpClient({
      productfeed_fr_v3: supplierFixture('pfconcept', 'productfeed'),
      printpricefeed_: supplierFixture('pfconcept', 'printpricefeed'),
      pricefeed_: supplierFixture('pfconcept', 'pricefeed'),
      stockfeed_: supplierFixture('pfconcept', 'stockfeed'),
      printdata_cfr1_fr_v3: supplierFixture('pfconcept', 'printdata'),
    })

  test('un model devient un produit, ses items des variantes', async ({ assert }) => {
    const [product] = await new PfConceptConnector(http()).fetchCatalogue({
      limit: 1,
      locale: 'fr',
    })

    assert.equal(product.externalId, 'TEST100')
    assert.equal(product.name, 'Mug isotherme Fixture 400ml')
    assert.equal(product.categoryRaw, 'Drinkware > Mugs isothermes')
    assert.equal(product.originCountry, 'CN')
    // Code douane conservé tel quel : pas de troncature des zéros de fin.
    assert.equal(product.hsCode, '9617000000')
    assert.deepEqual(product.keywords, ['mug', 'isotherme', 'café'])
    assert.deepEqual(product.materialLabels, ['Acier inoxydable'])
    assert.equal(product.leadTimeDays, 6)
    assert.deepEqual(
      product.variants.map((variant) => [variant.sku, variant.colorLabel, variant.stockQuantity]),
      [
        ['TEST10001', 'Bleu / Bleu marine', 1500],
        ['TEST10002', 'Rouge / Rouge', 0],
      ]
    )
    assert.equal(product.packaging?.outerCartonHeightMm, 255)
    assert.equal(product.packaging?.outerCartonGrossWeightG, 12500)
  })

  test('prix nets joints par article (« 8,25 » lu), promotion ignorée', async ({ assert }) => {
    const [product] = await new PfConceptConnector(http()).fetchCatalogue({
      limit: 1,
      locale: 'fr',
    })

    assert.deepEqual(product.variants[0].priceTiers, [
      { minQuantity: 1, unitPrice: 9.5 },
      { minQuantity: 100, unitPrice: 8.25 },
    ])
    // Fiche : la grille entière de l'article le moins cher (9 € d'appel), sans
    // mélange avec les paliers d'un autre article.
    assert.deepEqual(product.priceTiers, [
      { minQuantity: 1, unitPrice: 9 },
      { minQuantity: 100, unitPrice: 8.5 },
    ])
  })

  test('marquage : printfeedrefs → lignes, prix joints par printCode', async ({ assert }) => {
    const [product] = await new PfConceptConnector(http()).fetchCatalogue({
      limit: 1,
      locale: 'fr',
    })

    assert.lengthOf(product.markingPositions, 1)
    const [position] = product.markingPositions
    assert.equal(position.name, 'Côté droit')
    assert.equal(position.maxWidthMm, 60)
    assert.deepEqual(
      position.techniques.map((technique) => [technique.label, technique.setupCharge]),
      [
        ['Tampographie', 40],
        ['Gravure laser', null],
      ]
    )
    assert.deepEqual(position.techniques[0].priceTiers, [
      { minQuantity: 50, unitPrice: 0.5 },
      { minQuantity: 250, unitPrice: 0.3 },
    ])
  })

  test('images : URL de base + fichier, rôles dérivés, vides écartés', async ({ assert }) => {
    const [product] = await new PfConceptConnector(http()).fetchCatalogue({
      limit: 1,
      locale: 'fr',
    })

    assert.deepEqual(
      product.images.map((image) => image.role),
      ['primary', 'lifestyle']
    )
    assert.match(product.images[0].url, /^https:\/\/images\.pfconcept\.com\/.+TEST10001\.jpg$/)
  })

  test('--limit porte sur les models', async ({ assert }) => {
    const products = await new PfConceptConnector(http()).fetchCatalogue({ limit: 5, locale: 'fr' })
    assert.deepEqual(
      products.map((product) => product.externalId),
      ['TEST100', 'TEST200']
    )
  })

  test('un flux annexe en échec n’empêche pas l’import', async ({ assert }) => {
    const partial = new FakeSupplierHttpClient({
      productfeed_fr_v3: supplierFixture('pfconcept', 'productfeed'),
    })
    const [product] = await new PfConceptConnector(partial).fetchCatalogue({
      limit: 1,
      locale: 'fr',
    })
    assert.deepEqual(product.priceTiers, [])
    assert.isNull(product.variants[0].stockQuantity)
  })

  test('sans PFCONCEPT_FEED_CODE : erreur explicite, aucun appel', async ({ assert }) => {
    restore()
    restore = withSupplierCredentials({ pfconceptFeedCode: null })
    const client = http()
    const connector = new PfConceptConnector(client)

    assert.isFalse(connector.isConfigured())
    await assert.rejects(
      () => connector.fetchCatalogue({ limit: 1, locale: 'fr' }),
      SupplierConnectorNotConfiguredException
    )
    assert.lengthOf(client.requests, 0)
  })
})

test.group('Connecteur Passot', (group) => {
  group.each.setup(() => withSupplierCredentials({ passotApiKey: 'fake-passot-key' }))

  const http = () =>
    new FakeSupplierHttpClient({
      'catalog/products': supplierFixture('passot', 'products'),
      'catalog/prices': supplierFixture('passot', 'prices'),
      'catalog/stock': supplierFixture('passot', 'stock'),
      'customization/zones': supplierFixture('passot', 'zones'),
    })

  test('regroupe les déclinaisons sous main_sku, écarte les échantillons', async ({ assert }) => {
    const client = http()
    const products = await new PassotConnector(client).fetchCatalogue({ limit: 10, locale: 'fr' })

    assert.deepEqual(
      products.map((product) => product.externalId),
      ['FIXCUP', 'FIXPEN']
    )
    const [cup, pen] = products
    assert.deepEqual(
      cup.variants.map((variant) => [variant.sku, variant.colorLabel, variant.stockQuantity]),
      [
        ['FIXCUP#001', 'Bleu marine 02', 1200],
        ['FIXCUP#002', 'Blanc opaque 01', 0],
      ]
    )
    assert.equal(cup.lifecycleStatus, 'new')
    assert.equal(cup.originCountry, 'FR')
    assert.equal(cup.categoryRaw, 'Gobelets | Fabriqué en France')
    assert.equal(cup.packaging?.outerCartonGrossWeightG, 9800)
    assert.equal(
      cup.images[0].url,
      'https://media.pidesign.eu/media/catalog/product/f/i/fixcup_1.jpg'
    )
    // Sans parent configurable : parent déduit du préfixe avant `#`.
    assert.equal(pen.variants[0].sku, 'FIXPEN#010')
    assert.equal(pen.lifecycleStatus, 'end_of_series')

    // Clé d'API envoyée en en-tête, langue en préfixe d'URL.
    assert.isTrue(
      client.requests.every((request) => request.headers['PI-API-KEY'] === 'fake-passot-key')
    )
    assert.isTrue(client.requests.every((request) => request.url.includes('/fr/rest/V1/')))
  })

  test('prix de la fiche : la grille entière de la déclinaison la moins chère', async ({
    assert,
  }) => {
    const [cup] = await new PassotConnector(http()).fetchCatalogue({ limit: 1, locale: 'fr' })
    // FIXCUP#002 (0,45 € d'appel) l'emporte ; FIXCUP#001 garde sa propre grille.
    assert.deepEqual(cup.priceTiers, [
      { minQuantity: 1, unitPrice: 0.45 },
      { minQuantity: 500, unitPrice: 0.42 },
    ])
    assert.deepEqual(cup.variants[0].priceTiers, [
      { minQuantity: 1, unitPrice: 0.5 },
      { minQuantity: 500, unitPrice: 0.4 },
    ])
  })

  test('parent sans palier exploitable : repli sur les déclinaisons', async ({ assert }) => {
    const prices = supplierFixture('passot', 'prices') as { items: unknown[] }
    const client = new FakeSupplierHttpClient({
      'catalog/products': supplierFixture('passot', 'products'),
      'catalog/prices': { items: [{ sku: 'FIXCUP', tier_prices: [] }, ...prices.items] },
      'catalog/stock': supplierFixture('passot', 'stock'),
      'customization/zones': supplierFixture('passot', 'zones'),
    })
    const [cup] = await new PassotConnector(client).fetchCatalogue({ limit: 1, locale: 'fr' })
    assert.deepEqual(cup.priceTiers, [
      { minQuantity: 1, unitPrice: 0.45 },
      { minQuantity: 500, unitPrice: 0.42 },
    ])
  })

  test('zones → positions, méthodes express (is_priority) ignorées', async ({ assert }) => {
    const [cup] = await new PassotConnector(http()).fetchCatalogue({ limit: 1, locale: 'fr' })

    assert.deepEqual(
      cup.markingPositions.map((position) => [
        position.name,
        position.maxWidthMm,
        position.techniques.map((technique) => technique.label),
      ]),
      [
        ['M1 175x70 1 position par defaut', 175, ['SERIGRAPHIE']],
        ['QN1 209x70', 209, ['QUADRINUMERIQUE']],
      ]
    )
    assert.equal(cup.markingPositions[0].techniques[0].setupCharge, 40)
    assert.equal(cup.leadTimeDays, 10)
  })

  test('sans PASSOT_API_KEY : erreur explicite', async ({ assert }) => {
    const restore = withSupplierCredentials({ passotApiKey: null })
    try {
      await assert.rejects(
        () => new PassotConnector(http()).fetchCatalogue({ limit: 1, locale: 'fr' }),
        SupplierConnectorNotConfiguredException
      )
    } finally {
      restore()
    }
  })
})

test.group('Connecteur Inspirion', (group) => {
  group.each.setup(() => withSupplierCredentials({ inspirionApiKey: 'fake-inspirion-key' }))

  const http = () =>
    new FakeSupplierHttpClient(supplierFixture('inspirion', 'feeds') as Record<string, unknown>)

  test('un sku devient une fiche, ses article_id des déclinaisons', async ({ assert }) => {
    const client = http()
    const products = await new InspirionConnector(client).fetchCatalogue({
      limit: 10,
      locale: 'fr',
    })

    assert.deepEqual(
      products.map((product) => product.externalId),
      ['9990001', '9990010']
    )
    const [cup, pen] = products
    assert.equal(cup.description, 'Mug émaillé FIXTURE CUP : avec anse, contenance env. 350 ml')
    assert.equal(cup.hsCode, '7323940000')
    assert.equal(cup.originCountry, 'CN')
    assert.deepEqual(cup.materialLabels, ['Métal', 'Émail'])
    assert.equal(cup.categoryRaw, 'Cuisine et maison > Mugs et tasses')
    assert.deepEqual(
      cup.variants.map((variant) => [variant.sku, variant.colorLabel, variant.stockQuantity]),
      [
        ['56-9990001', 'noir, blanc', 640],
        ['56-9990002', 'rouge, blanc', 0],
      ]
    )
    // Galerie : images 300 px de la première déclinaison, puis images de détail.
    assert.deepEqual(cup.images, [
      { url: 'https://media.fixture.example/300/56-9990001_01.jpg', role: 'primary' },
      { url: 'https://media.fixture.example/300/9990001_detail.jpg', role: 'view' },
    ])
    assert.equal(cup.packaging?.unitGrossWeightG, 98)
    assert.equal(cup.packaging?.outerCartonQty, 60)
    assert.equal(cup.packaging?.outerCartonLengthMm, 375)
    assert.equal(cup.packaging?.outerCartonGrossWeightG, 5900)
    assert.equal(pen.brand, 'FixBrand')
    assert.deepEqual(pen.priceTiers, [])

    // Clé d'API en en-tête, langue en paramètre.
    assert.isTrue(
      client.requests.every(
        (request) => request.headers['X-Gateway-API-Key'] === 'fake-inspirion-key'
      )
    )
    assert.include(client.requests[0].url, '/api/v2/products?language=fr')
  })

  test('prix du compte par déclinaison, fiche = grille la moins chère', async ({ assert }) => {
    const [cup] = await new InspirionConnector(http()).fetchCatalogue({ limit: 1, locale: 'fr' })
    assert.deepEqual(cup.variants[0].priceTiers, [
      { minQuantity: 1, unitPrice: 5.4 },
      { minQuantity: 100, unitPrice: 5.1 },
    ])
    assert.deepEqual(cup.priceTiers, [
      { minQuantity: 1, unitPrice: 5 },
      { minQuantity: 100, unitPrice: 4.8 },
    ])
  })

  test('printdata → positions, prix du code d’impression par défaut', async ({ assert }) => {
    const [cup, pen] = await new InspirionConnector(http()).fetchCatalogue({
      limit: 10,
      locale: 'fr',
    })
    assert.deepEqual(cup.markingPositions, [
      {
        name: 'Sur le côté',
        // Plus grande surface parmi les codes (6 × 4 cm).
        maxWidthMm: 60,
        maxHeightMm: 40,
        techniques: [
          {
            label: 'Gravure laser',
            maxColors: 1,
            setupCharge: 30,
            priceTiers: [
              { minQuantity: 100, unitPrice: 1.98 },
              { minQuantity: 500, unitPrice: 1.5 },
            ],
          },
        ],
      },
    ])
    // Délai avec marquage quand il existe, sinon sans marquage.
    assert.equal(cup.leadTimeDays, 10)
    assert.equal(pen.leadTimeDays, 3)
  })

  test('un flux annexe en échec n’empêche pas l’import', async ({ assert }) => {
    const feeds = supplierFixture('inspirion', 'feeds') as Record<string, unknown>
    const client = new FakeSupplierHttpClient({ '/api/v2/products': feeds['/api/v2/products'] })
    const [cup] = await new InspirionConnector(client).fetchCatalogue({ limit: 1, locale: 'fr' })
    assert.equal(cup.externalId, '9990001')
    assert.deepEqual(cup.priceTiers, [])
    assert.deepEqual(cup.markingPositions, [])
  })

  test('sans INSPIRION_API_KEY : erreur explicite, aucun appel', async ({ assert }) => {
    const restore = withSupplierCredentials({ inspirionApiKey: null })
    const client = http()
    try {
      await assert.rejects(
        () => new InspirionConnector(client).fetchCatalogue({ limit: 1, locale: 'fr' }),
        SupplierConnectorNotConfiguredException
      )
      assert.lengthOf(client.requests, 0)
    } finally {
      restore()
    }
  })
})

test.group('Connecteur Makito', (group) => {
  group.each.setup(() =>
    withSupplierCredentials({ makitoEmail: 'fixture@example.com', makitoPassword: 'fake-password' })
  )

  const http = (login: unknown = { status: 1, msg: '42|fake-token' }) =>
    new FakeSupplierHttpClient({
      '/login': login,
      ...(supplierFixture('makito', 'feeds') as Record<string, unknown>),
    })

  test('login puis Bearer ; une ref devient une fiche, ses matnr des déclinaisons', async ({
    assert,
  }) => {
    const client = http()
    const products = await new MakitoConnector(client).fetchCatalogue({ limit: null, locale: 'fr' })

    assert.deepEqual(client.posts, [
      {
        url: 'https://data.makito.es/api/login',
        body: { email: 'fixture@example.com', password: 'fake-password' },
      },
    ])
    assert.isTrue(
      client.requests.every((request) => request.headers.Authorization === 'Bearer 42|fake-token')
    )
    // Langue française = identifiant 4.
    assert.isTrue(client.requests.some((request) => request.url.endsWith('/categories/4')))

    assert.deepEqual(
      products.map((product) => product.externalId),
      ['9001', '9002']
    )
    const [scarf, pen] = products
    // Nom de modèle préfixé du type d'article, sauf s'il le contient déjà.
    assert.equal(scarf.name, 'Foulard Fixy')
    assert.equal(pen.name, 'Stylo Fixpen')
    assert.equal(scarf.description, 'Foulard en coton organique.\n\nÉtui coton organique')
    assert.deepEqual(scarf.keywords, ['Foulard', 'Développement Durable', 'Pluie et hiver'])
    assert.equal(scarf.categoryRaw, 'Développement Durable | Nouveautés')
    assert.equal(scarf.lifecycleStatus, 'new')
    assert.equal(pen.lifecycleStatus, 'end_of_series')
    assert.equal(scarf.hsCode, '6117100000')
    assert.equal(scarf.originCountry, 'IN')
    assert.equal(pen.brand, 'FIXBRAND')
    assert.deepEqual(scarf.materialLabels, ['Coton Organique 70 g/ m2'])
    assert.deepEqual(scarf.packaging, {
      packageType: null,
      unitGrossWeightG: 78,
      outerCartonQty: 100,
      outerCartonLengthMm: 700,
      outerCartonWidthMm: 340,
      outerCartonHeightMm: 200,
      outerCartonGrossWeightG: 9600,
    })

    // Stock immédiat seulement, points de milliers (« 24.000 » = 24 000) ;
    // la taille « S/T » (sans taille) n'apparaît pas dans le libellé.
    assert.deepEqual(
      scarf.variants.map((variant) => [variant.sku, variant.colorLabel, variant.stockQuantity]),
      [
        ['19001008000', 'GRIS', 24000],
        ['19001002004', 'NOIR / XL', 0],
      ]
    )
    // Sans déclinaison dans le flux : la fiche seule.
    assert.deepEqual(
      pen.variants.map((variant) => variant.sku),
      ['9002']
    )
  })

  test('prix : « -500, 500, 2000 » = dès 1, 500, 2000 pièces', async ({ assert }) => {
    const [scarf, pen] = await new MakitoConnector(http()).fetchCatalogue({
      limit: null,
      locale: 'fr',
    })
    assert.deepEqual(scarf.priceTiers, [
      { minQuantity: 1, unitPrice: 4.4 },
      { minQuantity: 500, unitPrice: 4.2 },
      { minQuantity: 2000, unitPrice: 4.1 },
      { minQuantity: 5000, unitPrice: 3.9 },
    ])
    assert.deepEqual(pen.priceTiers, [])
  })

  test('images : principale d’abord, variantes et zones écartées', async ({ assert }) => {
    const [scarf] = await new MakitoConnector(http()).fetchCatalogue({ limit: 1, locale: 'fr' })
    assert.deepEqual(scarf.images, [
      { url: 'https://img.fixture.example/1000/9001/principal/9001-W.jpg', role: 'primary' },
      { url: 'https://img.fixture.example/1000/9001/bodegones/9001-B1.jpg', role: 'lifestyle' },
      { url: 'https://img.fixture.example/1000/9001/detalles/9001-D1.jpg', role: 'view' },
    ])
    assert.deepEqual(scarf.variants[0].images, [
      { url: 'https://img.fixture.example/9001-008-P.jpg', role: 'view' },
    ])
  })

  test('marquage : zones en cm, techniques jointes par technique_ref', async ({ assert }) => {
    const [scarf] = await new MakitoConnector(http()).fetchCatalogue({ limit: 1, locale: 'fr' })
    const transfer = {
      label: 'TRANSFERT SÉRIGRAPHIQUE',
      maxColors: 8,
      setupCharge: 30,
      // Bornes hautes « 250, 500, 2000 » → dès 1, 251, 501.
      priceTiers: [
        { minQuantity: 1, unitPrice: 0.5 },
        { minQuantity: 251, unitPrice: 0.4 },
        { minQuantity: 501, unitPrice: 0.3 },
      ],
    }
    assert.deepEqual(scarf.markingPositions, [
      {
        name: 'Sur le devant',
        maxWidthMm: 80,
        maxHeightMm: 50,
        techniques: [
          transfer,
          // Balises HTML retirées ; technique sans grille de prix conservée.
          {
            label: 'DIGITAL W1 (-5  cm2) (FULLCOLOR)',
            maxColors: 1,
            setupCharge: null,
            priceTiers: [],
          },
        ],
      },
      // Zone sans traduction : libellé de repli.
      { name: 'Zone 777', maxWidthMm: 280, maxHeightMm: 400, techniques: [transfer] },
    ])
    // Délai export le plus court des techniques de la fiche.
    assert.equal(scarf.leadTimeDays, 5)
  })

  test('--limit borne la page demandée et les fiches renvoyées', async ({ assert }) => {
    const client = http()
    const products = await new MakitoConnector(client).fetchCatalogue({ limit: 1, locale: 'fr' })
    assert.lengthOf(products, 1)
    assert.include(client.requests[0].url, '/products?page=1&per_page=1')
  })

  test('un flux annexe en échec n’empêche pas l’import', async ({ assert }) => {
    const feeds = supplierFixture('makito', 'feeds') as Record<string, unknown>
    const client = new FakeSupplierHttpClient({
      '/login': { status: 200, msg: '', token: '7|doc-token' },
      '/products': feeds['/products'],
    })
    const [scarf] = await new MakitoConnector(client).fetchCatalogue({ limit: 1, locale: 'fr' })
    assert.equal(scarf.name, 'Fixy')
    assert.deepEqual(scarf.priceTiers, [])
    assert.equal(client.requests[0].headers.Authorization, 'Bearer 7|doc-token')
  })

  test('identifiants refusés : erreur explicite, aucun flux demandé', async ({ assert }) => {
    const client = http({ status: 0, msg: 'Invalid credentials' })
    await assert.rejects(
      () => new MakitoConnector(client).fetchCatalogue({ limit: 1, locale: 'fr' }),
      SupplierFeedHttpException
    )
    assert.lengthOf(client.requests, 0)
  })

  test('sans identifiants : erreur explicite, aucun appel', async ({ assert }) => {
    const restore = withSupplierCredentials({ makitoPassword: null })
    const client = http()
    try {
      await assert.rejects(
        () => new MakitoConnector(client).fetchCatalogue({ limit: 1, locale: 'fr' }),
        SupplierConnectorNotConfiguredException
      )
      assert.lengthOf(client.posts, 0)
    } finally {
      restore()
    }
  })
})
