import { test } from '@japa/runner'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { RfqFactory } from '#database/factories/rfq_factory'
import { RfqItemFactory } from '#database/factories/rfq_item_factory'
import Product from '#models/product'
import Rfq from '#models/rfq'
import RfqItem from '#models/rfq_item'
import RfqSupplier from '#models/rfq_supplier'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'

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

  test('la fiche produit expose ce que peut faire un acheteur connecté', async ({
    client,
    assert,
  }) => {
    const { org, owner } = await buyerWithOwner()
    const product = await requestableProduct()
    const draft = await RfqFactory.merge({
      buyerOrganizationId: org.id,
      title: 'Brouillon',
    }).create()
    await RfqFactory.apply('published').merge({ buyerOrganizationId: org.id }).create()
    // Brouillon d'une autre organisation : jamais proposé.
    const other = await OrganizationFactory.create()
    await RfqFactory.merge({ buyerOrganizationId: other.id }).create()

    const response = await client.get(`/fr/products/${product.slug}`).withInertia().loginAs(owner)

    response.assertStatus(200)
    assert.deepEqual(response.inertiaProps.rfqContext, {
      canCreateRfq: true,
      drafts: [{ id: draft.id, title: 'Brouillon' }],
    })
  })

  test('la fiche produit ne propose rien à un visiteur ni à un fournisseur', async ({
    client,
    assert,
  }) => {
    const product = await requestableProduct()
    const supplierOrg = await OrganizationFactory.apply('supplier').create()
    const supplierUser = await createMember(supplierOrg, 'owner')
    const none = { canCreateRfq: false, drafts: [] }

    const anonymous = await client.get(`/fr/products/${product.slug}`).withInertia()
    const supplier = await client
      .get(`/fr/products/${product.slug}`)
      .withInertia()
      .loginAs(supplierUser)

    anonymous.assertStatus(200)
    assert.deepEqual(anonymous.inertiaProps.rfqContext, none)
    assert.deepEqual(supplier.inertiaProps.rfqContext, none)
  })

  test('un simple membre peut demander un devis mais pas modifier un brouillon', async ({
    client,
    assert,
  }) => {
    const { org } = await buyerWithOwner()
    const member = await createMember(org, 'member')
    await RfqFactory.merge({ buyerOrganizationId: org.id }).create()
    const product = await requestableProduct()

    const response = await client.get(`/fr/products/${product.slug}`).withInertia().loginAs(member)

    assert.deepEqual(response.inertiaProps.rfqContext, { canCreateRfq: true, drafts: [] })
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

  test('la recherche ne tourne que sur partial reload', async ({ client, assert }) => {
    const { owner } = await buyerWithOwner()

    const full = await client.get('/fr/rfqs/new?productSearch=crayon').withInertia().loginAs(owner)
    const reload = await client
      .get('/fr/rfqs/new?productSearch=crayon')
      .withInertia()
      .header('X-Inertia-Partial-Component', 'rfqs/create')
      .header('X-Inertia-Partial-Data', 'productResults')
      .loginAs(owner)

    assert.isUndefined(full.inertiaProps.productResults)
    const results = reload.inertiaProps.productResults as Array<{ name: string }>
    assert.isAbove(results.length, 0)
    assert.isTrue(results.some((row) => row.name.toLowerCase().includes('crayon')))
  })

  test('une saisie trop courte ou sans correspondance renvoie une liste vide', async ({
    client,
    assert,
  }) => {
    const { owner } = await buyerWithOwner()

    for (const term of ['c', 'zzzzzzzz']) {
      const response = await client
        .get(`/fr/rfqs/new?productSearch=${term}`)
        .withInertia()
        .header('X-Inertia-Partial-Component', 'rfqs/create')
        .header('X-Inertia-Partial-Data', 'productResults')
        .loginAs(owner)

      assert.deepEqual(response.inertiaProps.productResults, [], term)
    }
  })

  test('les produits inactifs ne sont pas proposés', async ({ client, assert }) => {
    const { owner } = await buyerWithOwner()
    await Product.query().update({ isActive: false })

    const response = await client
      .get('/fr/rfqs/new?productSearch=crayon')
      .withInertia()
      .header('X-Inertia-Partial-Component', 'rfqs/create')
      .header('X-Inertia-Partial-Data', 'productResults')
      .loginAs(owner)

    assert.deepEqual(response.inertiaProps.productResults, [])
  })

  test("la recherche est aussi disponible depuis l'édition d'un brouillon", async ({
    client,
    assert,
  }) => {
    const { org, owner } = await buyerWithOwner()
    const rfq = await RfqFactory.merge({ buyerOrganizationId: org.id }).create()

    const response = await client
      .get(`/fr/rfqs/${rfq.id}?productSearch=crayon`)
      .withInertia()
      .header('X-Inertia-Partial-Component', 'rfqs/show')
      .header('X-Inertia-Partial-Data', 'productResults')
      .loginAs(owner)

    assert.isAbove((response.inertiaProps.productResults as unknown[]).length, 0)
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

    response.assertStatus(302)
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

    response.assertStatus(302)
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

    // Sur une soumission de formulaire, Bouncer renvoie l'utilisateur d'où il
    // vient avec un message plutôt qu'une page 403.
    response.assertStatus(302)
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
