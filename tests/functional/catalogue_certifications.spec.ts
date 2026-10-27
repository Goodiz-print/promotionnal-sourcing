import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import Category from '#models/category'
import Certification from '#models/certification'
import Product from '#models/product'
import ProductSearchService from '#services/product_search_service'
import { installFakeEngine, type FakeEngineHandle } from '#tests/utils/fake_search_engine'
import { useDatabase } from '#tests/utils/setup'
import { seededDevUser } from '#tests/utils/organizations'

/**
 * Facette **certifications** filtrables (écart 4, ÉTAPE 6 — finalisation
 * Meilisearch). Transverse aux catégories : filtrage bout en bout sur le repli
 * PostgreSQL (navigation sans terme) comme sur le moteur (recherche par terme),
 * en ET fiable (le produit doit porter *tous* les labels cochés).
 */

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

  return Product.query().where('slug', slug).preload('certifications').firstOrFail()
}

async function catalogueSlugs(client: ApiClient, qs: Record<string, unknown>): Promise<string[]> {
  const response = await client.get('/fr/products').qs(qs).withInertia()
  return response.inertiaProps.products.data.map((p: { slug: string }) => p.slug)
}

test.group('Catalogue — filtre certifications (repli PostgreSQL)', (group) => {
  useDatabase(group, { seed: 'full' })

  test('une certification ne renvoie que les produits qui la portent', async ({
    client,
    assert,
  }) => {
    const gots = await Certification.findByOrFail('slug', 'gots')
    const ce = await Certification.findByOrFail('slug', 'ce')

    await createProduct(client, 'cert-gots', { certificationIds: [gots.id] })
    await createProduct(client, 'cert-ce', { certificationIds: [ce.id] })

    const slugs = await catalogueSlugs(client, { certificationIds: [gots.id] })

    assert.include(slugs, 'cert-gots')
    assert.notInclude(slugs, 'cert-ce')
    // Le produit de démo « casquette » porte GOTS dans le seed.
    assert.include(slugs, 'casquette-6-panneaux-marine')
  })

  test('plusieurs certifications se combinent en ET (toutes requises)', async ({
    client,
    assert,
  }) => {
    const gots = await Certification.findByOrFail('slug', 'gots')
    const fsc = await Certification.findByOrFail('slug', 'fsc')

    await createProduct(client, 'cert-gots-fsc', { certificationIds: [gots.id, fsc.id] })
    await createProduct(client, 'cert-gots-seul', { certificationIds: [gots.id] })

    const slugs = await catalogueSlugs(client, { certificationIds: [gots.id, fsc.id] })

    // Seul le produit portant les DEUX labels remonte.
    assert.include(slugs, 'cert-gots-fsc')
    assert.notInclude(slugs, 'cert-gots-seul')
  })

  test('se combine avec un autre critère (made-in-Europe)', async ({ client, assert }) => {
    const gots = await Certification.findByOrFail('slug', 'gots')

    await createProduct(client, 'cert-gots-eu', {
      certificationIds: [gots.id],
      originCountry: 'FR',
      madeInEurope: true,
    })
    await createProduct(client, 'cert-gots-hors-eu', {
      certificationIds: [gots.id],
      originCountry: 'CN',
      madeInEurope: false,
    })

    const slugs = await catalogueSlugs(client, {
      certificationIds: [gots.id],
      madeInEurope: 'true',
    })

    assert.include(slugs, 'cert-gots-eu')
    assert.notInclude(slugs, 'cert-gots-hors-eu')
  })
})

test.group('Catalogue — filtre certifications (moteur)', (group) => {
  useDatabase(group, { seed: 'full' })

  let handle: FakeEngineHandle
  group.each.setup(() => {
    handle = installFakeEngine(true)
    return () => handle.restore()
  })

  test('le filtre certifications est transmis au moteur', async ({ assert }) => {
    const gots = await Certification.findByOrFail('slug', 'gots')
    handle.engine.hits = { ids: [], total: 0 }

    const search = await app.container.make(ProductSearchService)
    await search.search({
      search: 'casquette',
      categoryId: null,
      madeInEurope: false,
      attributeValueIds: [],
      certificationIds: [gots.id],
      originZones: [],
      newOnly: false,
      ecoOnly: false,
      page: 1,
      perPage: 12,
    })

    assert.lengthOf(handle.engine.requests, 1)
    assert.deepEqual(handle.engine.requests[0].filter.certificationIds, [gots.id])
  })

  test('le rechargement revérifie la certification (un produit sans le label est écarté)', async ({
    client,
    assert,
  }) => {
    const gots = await Certification.findByOrFail('slug', 'gots')
    const withLabel = await createProduct(client, 'moteur-cert-gots', {
      certificationIds: [gots.id],
    })
    const withoutLabel = await createProduct(client, 'moteur-cert-aucun', { certificationIds: [] })

    // Le moteur renvoie les deux, mais seul celui qui porte réellement le label
    // doit survivre au rechargement PostgreSQL (le ET garanti deux fois).
    handle.engine.hits = { ids: [withLabel.id, withoutLabel.id], total: 2 }

    const search = await app.container.make(ProductSearchService)
    const page = await search.search({
      search: 'moteur-cert',
      categoryId: null,
      madeInEurope: false,
      attributeValueIds: [],
      certificationIds: [gots.id],
      originZones: [],
      newOnly: false,
      ecoOnly: false,
      page: 1,
      perPage: 12,
    })

    const slugs = page!.all().map((product) => product.slug)
    assert.include(slugs, 'moteur-cert-gots')
    assert.notInclude(slugs, 'moteur-cert-aucun')
  })
})
