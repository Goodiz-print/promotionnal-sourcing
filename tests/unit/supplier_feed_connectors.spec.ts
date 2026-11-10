import { test } from '@japa/runner'
import PfConceptConnector from '#services/supplier_feed/pfconcept_connector'
import PassotConnector from '#services/supplier_feed/passot_connector'
import InspirionConnector from '#services/supplier_feed/inspirion_connector'
import ReferenceMatcher from '#shared/helpers/reference_matcher'
import {
  SupplierConnectorNotConfiguredException,
  SupplierConnectorNotImplementedException,
} from '#exceptions/supplier_feed_errors'
import { normalizeCountry, parseDecimal, redactUrl } from '#shared/helpers/supplier_feed'
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

  test('redactUrl masque le code distributeur et la query string', ({ assert }) => {
    const url = `https://feeds.example/pricefeed_${FAKE_FEED_CODE}_v3.json?key=secret`
    const redacted = redactUrl(url)
    assert.notInclude(redacted, FAKE_FEED_CODE)
    assert.notInclude(redacted, 'secret')
    assert.equal(redacted, 'https://feeds.example/pricefeed_***_v3.json?***')
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
    assert.equal(product.hsCode, '9617')
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
    // Fiche : le moins cher des articles à chaque palier.
    assert.deepEqual(product.priceTiers, [
      { minQuantity: 1, unitPrice: 9 },
      { minQuantity: 100, unitPrice: 8.25 },
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

  test('prix de la fiche : le moins cher des déclinaisons par palier', async ({ assert }) => {
    const [cup] = await new PassotConnector(http()).fetchCatalogue({ limit: 1, locale: 'fr' })
    assert.deepEqual(cup.priceTiers, [
      { minQuantity: 1, unitPrice: 0.45 },
      { minQuantity: 500, unitPrice: 0.4 },
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

test.group('Connecteurs en attente de documentation', () => {
  test('Inspirion : non implémenté (ou non configuré)', async ({ assert }) => {
    try {
      await new InspirionConnector().fetchCatalogue()
      assert.fail('should throw')
    } catch (error) {
      assert.isTrue(
        error instanceof SupplierConnectorNotImplementedException ||
          error instanceof SupplierConnectorNotConfiguredException
      )
    }
  })
})
