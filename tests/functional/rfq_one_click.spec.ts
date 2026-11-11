import { test } from '@japa/runner'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { RfqFactory } from '#database/factories/rfq_factory'
import { RfqItemFactory } from '#database/factories/rfq_item_factory'
import Organization from '#models/organization'
import Product from '#models/product'
import Rfq from '#models/rfq'
import RfqItem from '#models/rfq_item'
import RfqSupplier from '#models/rfq_supplier'
import { createMember } from '#tests/utils/organizations'
import { installFakeEngine, type FakeEngineHandle } from '#tests/utils/fake_search_engine'
import { useDatabase } from '#tests/utils/setup'
import type User from '#models/user'
import type { ApiClient } from '@japa/api-client'

/**
 * Demande de devis « en un clic » (#55) : pré-remplissage depuis une fiche
 * produit, ajout à un brouillon, recherche du sélecteur et suppression d'un
 * brouillon. Les produits viennent du seed `full` (catalogue de démonstration).
 */
async function requestableProduct(): Promise<Product> {
  return Product.query()
    .where('isActive', true)
    .whereHas('supplier', (supplier) => supplier.whereNotNull('organizationId'))
    .preload('supplier')
    .preload('translations')
    .orderBy('id')
    .firstOrFail()
}

async function buyerWithOwner() {
  const org = await OrganizationFactory.create()
  const owner = await createMember(org, 'owner')
  return { org, owner }
}

test.group('RFQ en un clic — pré-remplissage depuis un produit', (group) => {
  useDatabase(group, { seed: 'full' })

  test('le formulaire reçoit le produit et son fournisseur', async ({ client, assert }) => {
    const { owner } = await buyerWithOwner()
    const product = await requestableProduct()

    const response = await client
      .get(`/fr/rfqs/new?productId=${product.id}`)
      .withInertia()
      .loginAs(owner)

    response.assertStatus(200)
    const prefill = response.inertiaProps.prefillProduct
    assert.equal(prefill.id, product.id)
    assert.equal(prefill.slug, product.slug)
    assert.isNotEmpty(prefill.name)
    assert.equal(prefill.categoryId, product.categoryId)
    assert.equal(prefill.minQuantity, product.minQuantity)
    assert.equal(prefill.supplierOrganizationId, product.supplier.organizationId)
  })

  test('un produit inconnu ou masqué ouvre un formulaire vide', async ({ client, assert }) => {
    const { owner } = await buyerWithOwner()
    const product = await requestableProduct()
    await product.merge({ isActive: false }).save()

    const unknown = await client.get('/fr/rfqs/new?productId=999999').withInertia().loginAs(owner)
    const inactive = await client
      .get(`/fr/rfqs/new?productId=${product.id}`)
      .withInertia()
      .loginAs(owner)

    unknown.assertStatus(200)
    assert.isUndefined(unknown.inertiaProps.prefillProduct)
    inactive.assertStatus(200)
    assert.isUndefined(inactive.inertiaProps.prefillProduct)
  })

  test('un productId mal formé est ignoré', async ({ client, assert }) => {
    const { owner } = await buyerWithOwner()

    for (const query of ['productId=12abc', 'productId[]=3', 'productId=-4']) {
      const response = await client.get(`/fr/rfqs/new?${query}`).withInertia().loginAs(owner)

      response.assertStatus(200)
      assert.isUndefined(response.inertiaProps.prefillProduct, query)
    }
  })

  test('la fiche produit expose ce que peut faire un acheteur connecté', async ({
    client,
    assert,
  }) => {
    const { owner } = await buyerWithOwner()
    const product = await requestableProduct()

    const response = await client.get(`/fr/products/${product.slug}`).withInertia().loginAs(owner)

    response.assertStatus(200)
    assert.deepEqual(response.inertiaProps.rfqContext, { canCreateRfq: true, inCart: false })
  })

  test('la fiche produit ne propose rien à un visiteur ni à un fournisseur', async ({
    client,
    assert,
  }) => {
    const product = await requestableProduct()
    const supplierOrg = await OrganizationFactory.apply('supplier').create()
    const supplierUser = await createMember(supplierOrg, 'owner')
    const none = { canCreateRfq: false, inCart: false }

    const anonymous = await client.get(`/fr/products/${product.slug}`).withInertia()
    const supplier = await client
      .get(`/fr/products/${product.slug}`)
      .withInertia()
      .loginAs(supplierUser)

    anonymous.assertStatus(200)
    assert.deepEqual(anonymous.inertiaProps.rfqContext, none)
    assert.deepEqual(supplier.inertiaProps.rfqContext, none)
  })

  test('un simple membre peut demander un devis', async ({ client, assert }) => {
    const { org } = await buyerWithOwner()
    const member = await createMember(org, 'member')
    const product = await requestableProduct()

    const response = await client.get(`/fr/products/${product.slug}`).withInertia().loginAs(member)

    assert.deepEqual(response.inertiaProps.rfqContext, { canCreateRfq: true, inCart: false })
  })
})

test.group('RFQ en un clic — ajout à un brouillon', (group) => {
  useDatabase(group, { seed: 'full' })

  test('ajoute la ligne produit et son fournisseur au brouillon', async ({ client, assert }) => {
    const { org, owner } = await buyerWithOwner()
    const product = await requestableProduct()
    const rfq = await RfqFactory.merge({ buyerOrganizationId: org.id }).create()
    await RfqItemFactory.merge({ rfqId: rfq.id, name: 'Ligne existante' }).create()

    const response = await client
      .post(`/fr/rfqs/${rfq.id}/items/from-product`)
      .withInertia()
      .withCsrfToken()
      .redirects(0)
      .loginAs(owner)
      .json({ productId: product.id })

    response.assertStatus(302)
    const items = await RfqItem.query().where('rfqId', rfq.id).orderBy('id')
    assert.lengthOf(items, 2)
    assert.equal(items[0].name, 'Ligne existante')
    assert.equal(items[1].productId, product.id)
    assert.equal(items[1].categoryId, product.categoryId)
    assert.equal(items[1].quantity, product.minQuantity ?? 1)

    const [target] = await RfqSupplier.query().where('rfqId', rfq.id)
    assert.equal(target.supplierOrganizationId, product.supplier.organizationId)
    assert.equal(target.status, 'pending')
  })

  test('ajouter deux fois le même produit ne duplique pas le destinataire', async ({
    client,
    assert,
  }) => {
    const { org, owner } = await buyerWithOwner()
    const product = await requestableProduct()
    const rfq = await RfqFactory.merge({ buyerOrganizationId: org.id }).create()

    for (let attempt = 0; attempt < 2; attempt++) {
      await client
        .post(`/fr/rfqs/${rfq.id}/items/from-product`)
        .withInertia()
        .withCsrfToken()
        .redirects(0)
        .loginAs(owner)
        .json({ productId: product.id })
    }

    assert.lengthOf(await RfqItem.query().where('rfqId', rfq.id), 2)
    assert.lengthOf(await RfqSupplier.query().where('rfqId', rfq.id), 1)
  })

  test("un fournisseur inéligible : ni ligne ni destinataire n'est écrit", async ({
    client,
    assert,
  }) => {
    const { org, owner } = await buyerWithOwner()
    const product = await requestableProduct()
    await Organization.query()
      .where('id', product.supplier.organizationId!)
      .update({ organizationType: 'buyer' })
    const rfq = await RfqFactory.merge({ buyerOrganizationId: org.id }).create()

    const response = await client
      .post(`/fr/rfqs/${rfq.id}/items/from-product`)
      .withInertia()
      .withCsrfToken()
      .redirects(0)
      .loginAs(owner)
      .json({ productId: product.id })

    response.assertStatus(302)
    assert.lengthOf(await RfqItem.query().where('rfqId', rfq.id), 0)
    assert.lengthOf(await RfqSupplier.query().where('rfqId', rfq.id), 0)
  })

  test("refuse l'ajout à une demande publiée", async ({ client, assert }) => {
    const { org, owner } = await buyerWithOwner()
    const product = await requestableProduct()
    const rfq = await RfqFactory.apply('published').merge({ buyerOrganizationId: org.id }).create()

    const response = await client
      .post(`/fr/rfqs/${rfq.id}/items/from-product`)
      .withInertia()
      .withCsrfToken()
      .redirects(0)
      .loginAs(owner)
      .json({ productId: product.id })

    response.assertStatus(302)
    assert.lengthOf(await RfqItem.query().where('rfqId', rfq.id), 0)
  })

  test('un produit inconnu est un 404 et le brouillon reste intact', async ({ client, assert }) => {
    const { org, owner } = await buyerWithOwner()
    const rfq = await RfqFactory.merge({ buyerOrganizationId: org.id }).create()

    const response = await client
      .post(`/fr/rfqs/${rfq.id}/items/from-product`)
      .withInertia()
      .withCsrfToken()
      .redirects(0)
      .loginAs(owner)
      .json({ productId: 999999 })

    response.assertStatus(404)
    assert.lengthOf(await RfqItem.query().where('rfqId', rfq.id), 0)
  })

  test("le brouillon d'une autre organisation est introuvable", async ({ client, assert }) => {
    const { owner } = await buyerWithOwner()
    const product = await requestableProduct()
    const other = await OrganizationFactory.create()
    const rfq = await RfqFactory.merge({ buyerOrganizationId: other.id }).create()

    const response = await client
      .post(`/fr/rfqs/${rfq.id}/items/from-product`)
      .withInertia()
      .withCsrfToken()
      .redirects(0)
      .loginAs(owner)
      .json({ productId: product.id })

    response.assertStatus(404)
    assert.lengthOf(await RfqItem.query().where('rfqId', rfq.id), 0)
  })
})

test.group('RFQ en un clic — sélecteur de produit', (group) => {
  useDatabase(group, { seed: 'full' })

  // Le sélecteur interroge le moteur (#112, ADR 0002) : un double répond ce qu'on lui dit.
  let handle: FakeEngineHandle
  group.each.setup(() => {
    handle = installFakeEngine()
    return () => handle.restore()
  })

  async function slugIds(...slugs: string[]): Promise<number[]> {
    const products = await Product.query().whereIn('slug', slugs)
    return slugs.map((slug) => products.find((product) => product.slug === slug)!.id)
  }

  async function lookup(client: ApiClient, owner: User, term: string, locale = 'fr') {
    return client
      .get(`/${locale}/rfqs/new?productSearch=${term}`)
      .withInertia()
      .header('X-Inertia-Partial-Component', 'rfqs/create')
      .header('X-Inertia-Partial-Data', 'productResults,productSearchUnavailable')
      .loginAs(owner)
  }

  test('la recherche ne tourne que sur partial reload', async ({ client, assert }) => {
    const { owner } = await buyerWithOwner()
    handle.engine.hits = { ids: await slugIds('crayon-hb-bleu', 'crayon-hb-rouge'), total: 2 }

    const full = await client.get('/fr/rfqs/new?productSearch=crayon').withInertia().loginAs(owner)
    const reload = await lookup(client, owner, 'crayon')

    assert.isUndefined(full.inertiaProps.productResults)
    const results = reload.inertiaProps.productResults as Array<{ name: string }>
    assert.lengthOf(results, 2)
    assert.isFalse(reload.inertiaProps.productSearchUnavailable)
    assert.isTrue(results.some((row) => row.name.toLowerCase().includes('crayon')))
  })

  test('une saisie trop courte n’interroge pas le moteur ; sans correspondance : liste vide', async ({
    client,
    assert,
  }) => {
    const { owner } = await buyerWithOwner()

    const short = await lookup(client, owner, 'c')
    assert.deepEqual(short.inertiaProps.productResults, [])
    assert.lengthOf(handle.engine.requests, 0)

    const none = await lookup(client, owner, 'zzzzzzzz')
    assert.deepEqual(none.inertiaProps.productResults, [])
    assert.lengthOf(handle.engine.requests, 1)
  })

  test('les produits inactifs ne sont pas proposés', async ({ client, assert }) => {
    const { owner } = await buyerWithOwner()
    handle.engine.hits = { ids: await slugIds('crayon-hb-bleu'), total: 1 }
    await Product.query().update({ isActive: false })

    const response = await lookup(client, owner, 'crayon')

    assert.deepEqual(response.inertiaProps.productResults, [])
  })

  test('moteur indisponible : le sélecteur le signale, ce n’est pas « aucun produit »', async ({
    client,
    assert,
  }) => {
    const { owner } = await buyerWithOwner()
    handle.engine.hits = new Error('connect ECONNREFUSED')

    const response = await lookup(client, owner, 'crayon')

    assert.isTrue(response.inertiaProps.productSearchUnavailable)
    assert.deepEqual(response.inertiaProps.productResults, [])
  })

  test("la recherche est aussi disponible depuis l'édition d'un brouillon", async ({
    client,
    assert,
  }) => {
    const { org, owner } = await buyerWithOwner()
    const rfq = await RfqFactory.merge({ buyerOrganizationId: org.id }).create()
    handle.engine.hits = { ids: await slugIds('crayon-hb-bleu'), total: 1 }

    const response = await client
      .get(`/fr/rfqs/${rfq.id}?productSearch=crayon`)
      .withInertia()
      .header('X-Inertia-Partial-Component', 'rfqs/show')
      .header('X-Inertia-Partial-Data', 'productResults')
      .loginAs(owner)

    assert.lengthOf(response.inertiaProps.productResults as unknown[], 1)
  })
})

test.group('RFQ en un clic — suppression d’un brouillon', (group) => {
  useDatabase(group, { seed: 'roles' })

  test('supprime le brouillon avec ses lignes et ses destinataires', async ({ client, assert }) => {
    const { org, owner } = await buyerWithOwner()
    const supplier = await OrganizationFactory.apply('supplier').create()
    const rfq = await RfqFactory.merge({ buyerOrganizationId: org.id }).create()
    await RfqItemFactory.merge({ rfqId: rfq.id }).create()
    await RfqSupplier.create({
      rfqId: rfq.id,
      supplierOrganizationId: supplier.id,
      status: 'pending',
    })

    const response = await client
      .delete(`/fr/rfqs/${rfq.id}`)
      .withInertia()
      .withCsrfToken()
      .redirects(0)
      .loginAs(owner)

    response.assertStatus(303)
    response.assertHeader('location', '/fr/rfqs')
    assert.isNull(await Rfq.find(rfq.id))
    assert.lengthOf(await RfqItem.query().where('rfqId', rfq.id), 0)
    assert.lengthOf(await RfqSupplier.query().where('rfqId', rfq.id), 0)
  })

  test('refuse de supprimer une demande publiée', async ({ client, assert }) => {
    const { org, owner } = await buyerWithOwner()
    const rfq = await RfqFactory.apply('published').merge({ buyerOrganizationId: org.id }).create()

    const response = await client
      .delete(`/fr/rfqs/${rfq.id}`)
      .withInertia()
      .withCsrfToken()
      .redirects(0)
      .loginAs(owner)

    response.assertStatus(303)
    response.assertHeader('location', `/fr/rfqs/${rfq.id}`)
    assert.isNotNull(await Rfq.find(rfq.id))
  })

  test('un simple membre ne peut pas supprimer', async ({ client, assert }) => {
    const { org } = await buyerWithOwner()
    const member = await createMember(org, 'member')
    const rfq = await RfqFactory.merge({ buyerOrganizationId: org.id }).create()

    const response = await client
      .delete(`/fr/rfqs/${rfq.id}`)
      .withInertia()
      .withCsrfToken()
      .redirects(0)
      .loginAs(member)

    // Inertia convertit la redirection d'un DELETE en 303. Sur une soumission de formulaire, Bouncer renvoie l'utilisateur d'où il
    // vient avec un message plutôt qu'une page 403.
    response.assertStatus(303)
    assert.isNotNull(await Rfq.find(rfq.id))
  })

  test("une demande d'une autre organisation est introuvable", async ({ client, assert }) => {
    const { owner } = await buyerWithOwner()
    const other = await OrganizationFactory.create()
    const rfq = await RfqFactory.merge({ buyerOrganizationId: other.id }).create()

    const response = await client
      .delete(`/fr/rfqs/${rfq.id}`)
      .withInertia()
      .withCsrfToken()
      .redirects(0)
      .loginAs(owner)

    response.assertStatus(404)
    assert.isNotNull(await Rfq.find(rfq.id))
  })
})

test.group('RFQ en un clic — lien avec le catalogue', (group) => {
  useDatabase(group, { seed: 'full' })

  test('un productId inconnu ou masqué est détaché de la ligne, pas refusé', async ({
    client,
    assert,
  }) => {
    const { owner } = await buyerWithOwner()
    const visible = await requestableProduct()
    const hidden = await Product.query()
      .whereNot('id', visible.id)
      .where('isActive', true)
      .firstOrFail()
    await hidden.merge({ isActive: false }).save()

    const response = await client
      .post('/fr/rfqs')
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)
      .json({
        title: 'Liens catalogue',
        items: [
          { name: 'Produit visible', quantity: 10, productId: visible.id },
          { name: 'Produit masqué', quantity: 10, productId: hidden.id },
          { name: 'Produit inconnu', quantity: 10, productId: 999999 },
        ],
      })

    response.assertStatus(200)
    const rfq = await Rfq.findByOrFail('title', 'Liens catalogue')
    const items = await RfqItem.query().where('rfqId', rfq.id).orderBy('id')
    assert.deepEqual(
      items.map((item) => item.productId),
      [visible.id, null, null]
    )
  })
})
