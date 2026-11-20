import { test } from '@japa/runner'
import emitter from '@adonisjs/core/services/emitter'
import mail from '@adonisjs/mail/services/main'
import RfqReceivedNotification from '#mails/rfq_received_notification'
import type { RfqReceivedMailData } from '#shared/types/mail'
import { OrganizationFactory } from '#database/factories/organization_factory'
import RfqSent from '#events/rfq_sent'
import { ProductFactory } from '#database/factories/product_factory'
import { MarkingTechniqueFactory } from '#database/factories/marking_technique_factory'
import { ProductMarkingPositionFactory } from '#database/factories/product_marking_position_factory'
import { ProductMarkingPositionTechniqueFactory } from '#database/factories/product_marking_position_technique_factory'
import { ProductMarkingPriceTierFactory } from '#database/factories/product_marking_price_tier_factory'
import { ProductPriceTierFactory } from '#database/factories/product_price_tier_factory'
import { ProductVariantFactory } from '#database/factories/product_variant_factory'
import { SupplierFactory } from '#database/factories/supplier_factory'
import Organization from '#models/organization'
import type Product from '#models/product'
import QuoteCartItem from '#models/quote_cart_item'
import Rfq from '#models/rfq'
import RfqItem from '#models/rfq_item'
import { createMember } from '#tests/utils/organizations'
import { RFQ_DEADLINE_TIMEZONE } from '#shared/types/rfq'
import { useDatabase } from '#tests/utils/setup'
import type User from '#models/user'
import type { ApiClient } from '@japa/api-client'

/**
 * Panier de devis : ajout depuis le catalogue, édition, cloisonnement, puis
 * validation éclatée en une demande par fournisseur. Chaque produit a sa propre
 * organisation fournisseuse (factories).
 */

/**
 * Produit demandable d'une organisation fournisseuse qui lui est propre.
 * `supplier.organization` préchargé.
 */
async function supplierProduct(minQuantity: number | null = 100): Promise<Product> {
  const org = await OrganizationFactory.apply('supplier').create()
  const supplier = await SupplierFactory.merge({ organizationId: org.id }).create()
  const product = await ProductFactory.merge({ supplierId: supplier.id, minQuantity })
    .with('category')
    .create()
  await product.load('supplier', (query) => query.preload('organization'))
  return product
}

/** Deux produits de deux organisations fournisseuses différentes. */
async function productsOfTwoSuppliers(): Promise<[Product, Product]> {
  return [await supplierProduct(), await supplierProduct(null)]
}

async function buyerWithOwner() {
  const org = await OrganizationFactory.create()
  const owner = await createMember(org, 'owner')
  return { org, owner }
}

function addToCart(
  client: ApiClient,
  user: User,
  productId: number,
  quantity?: number,
  variantId?: number
) {
  return client
    .post('/fr/quote-cart/items')
    .withInertia()
    .withCsrfToken()
    .redirects(0)
    .loginAs(user)
    .json({ productId, ...(quantity ? { quantity } : {}), ...(variantId ? { variantId } : {}) })
}

function updateLine(client: ApiClient, user: User, id: number, payload: Record<string, unknown>) {
  return client
    .patch(`/fr/quote-cart/items/${id}`)
    .withInertia()
    .withCsrfToken()
    .redirects(0)
    .loginAs(user)
    .json(payload)
}

/**
 * Produit chiffré : grille produit (100 → 2,10 ; 250 → 1,85 ; 500 → 1,60),
 * deux variantes dont une (`blue`) a sa propre grille (100 → 2,50), et un
 * marquage (une position, une technique : 4 couleurs max, 45 € de frais
 * techniques, 0,40 puis 0,30 dès 250 pièces).
 */
async function pricedProduct() {
  const product = await supplierProduct(100)
  const [red, blue] = await ProductVariantFactory.merge({ productId: product.id }).createMany(2)
  await ProductPriceTierFactory.merge([
    { productId: product.id, minQuantity: 100, unitPrice: '2.1000' },
    { productId: product.id, minQuantity: 250, unitPrice: '1.8500' },
    { productId: product.id, minQuantity: 500, unitPrice: '1.6000' },
    { productId: product.id, variantId: blue.id, minQuantity: 100, unitPrice: '2.5000' },
  ]).createMany(4)
  const technique = await MarkingTechniqueFactory.create()
  const position = await ProductMarkingPositionFactory.merge({
    productId: product.id,
    name: 'Face',
  }).create()
  const marking = await ProductMarkingPositionTechniqueFactory.merge({
    markingPositionId: position.id,
    markingTechniqueId: technique.id,
    maxColors: 4,
    defaultSetupCharge: '45.00',
  }).create()
  await ProductMarkingPriceTierFactory.merge([
    { productId: product.id, markingTechniqueId: technique.id, minQuantity: 1, unitPrice: '0.40' },
    {
      productId: product.id,
      markingTechniqueId: technique.id,
      minQuantity: 250,
      unitPrice: '0.30',
    },
  ]).createMany(2)
  return { product, red, blue, marking, technique }
}

interface LineProps {
  id: number
  quantity: number
  variantId: number | null
  estimate: {
    unitPrice: string | null
    total: string | null
    markingUnitPrice: string | null
    setupCharge: string | null
    nextTier: { minQuantity: number } | null
  } | null
}

async function cartGroups(client: ApiClient, user: User) {
  const response = await client.get('/fr/quote-cart').withInertia().loginAs(user)
  return response.inertiaProps.groups as Array<{
    items: LineProps[]
    subtotals: { currency: string; total: string }[]
    estimateComplete: boolean
  }>
}

function checkout(client: ApiClient, user: User, payload: Record<string, unknown>) {
  return client
    .post('/fr/quote-cart/checkout')
    .withInertia()
    .withCsrfToken()
    .redirects(0)
    .loginAs(user)
    .json(payload)
}

test.group('Panier de devis — contenu', (cartGroup) => {
  useDatabase(cartGroup)

  test('ajoute un produit à sa quantité minimale, sans doublon', async ({ client, assert }) => {
    const { org, owner } = await buyerWithOwner()
    const [product] = await productsOfTwoSuppliers()

    const first = await addToCart(client, owner, product.id)
    const second = await addToCart(client, owner, product.id, 999)
    first.assertStatus(302)
    second.assertStatus(302)

    const items = await QuoteCartItem.query().where('userId', owner.id)
    assert.lengthOf(items, 1)
    assert.equal(items[0].organizationId, org.id)
    assert.equal(items[0].productId, product.id)
    // Le second ajout ne touche pas la ligne existante.
    assert.equal(items[0].quantity, product.minQuantity ?? 1)
  })

  test('ajoute à la quantité demandée', async ({ client, assert }) => {
    const { owner } = await buyerWithOwner()
    const [product] = await productsOfTwoSuppliers()

    await addToCart(client, owner, product.id, 750)

    const item = await QuoteCartItem.query().where('userId', owner.id).firstOrFail()
    assert.equal(item.quantity, 750)
  })

  test('refuse un produit inconnu ou masqué', async ({ client, assert }) => {
    const { owner } = await buyerWithOwner()
    const [product] = await productsOfTwoSuppliers()
    await product.merge({ isActive: false }).save()

    const unknown = await addToCart(client, owner, 999999)
    const hidden = await addToCart(client, owner, product.id)
    unknown.assertStatus(404)
    hidden.assertStatus(404)
    assert.lengthOf(await QuoteCartItem.query().where('userId', owner.id), 0)
  })

  test('la page groupe les lignes par fournisseur et la pastille les compte', async ({
    client,
    assert,
  }) => {
    const { owner } = await buyerWithOwner()
    const [first, second] = await productsOfTwoSuppliers()
    await addToCart(client, owner, first.id)
    await addToCart(client, owner, second.id)

    const response = await client.get('/fr/quote-cart').withInertia().loginAs(owner)

    response.assertStatus(200)
    const groups = response.inertiaProps.groups as Array<{
      supplierOrganizationId: number | null
      items: Array<{ productId: number }>
    }>
    assert.deepEqual(
      groups.map((entry) => entry.supplierOrganizationId),
      [first.supplier.organizationId, second.supplier.organizationId]
    )
    assert.deepEqual(
      groups[0].items.map((item) => item.productId),
      [first.id]
    )
    assert.equal(response.inertiaProps.quoteCartCount, 2)
    assert.isTrue(response.inertiaProps.canSend)
  })

  test('la fiche produit sait que le produit est au panier', async ({ client, assert }) => {
    const { owner } = await buyerWithOwner()
    const [product] = await productsOfTwoSuppliers()
    await addToCart(client, owner, product.id)

    const response = await client.get(`/fr/products/${product.slug}`).withInertia().loginAs(owner)

    assert.deepEqual(response.inertiaProps.rfqContext, {
      canCreateRfq: true,
      inCartVariantIds: [null],
    })
  })

  test("un produit d'un fournisseur devenu inéligible passe en « non joignable »", async ({
    client,
    assert,
  }) => {
    const { owner } = await buyerWithOwner()
    const [product] = await productsOfTwoSuppliers()
    await addToCart(client, owner, product.id)
    await Organization.query()
      .where('id', product.supplier.organizationId!)
      .update({ organizationType: 'buyer' })

    const response = await client.get('/fr/quote-cart').withInertia().loginAs(owner)

    const [unreachable] = response.inertiaProps.groups
    assert.isNull(unreachable.supplierOrganizationId)
    assert.equal(unreachable.items[0].productId, product.id)
  })

  test('modifie et retire une ligne', async ({ client, assert }) => {
    const { owner } = await buyerWithOwner()
    const [product] = await productsOfTwoSuppliers()
    await addToCart(client, owner, product.id)
    const item = await QuoteCartItem.query().where('userId', owner.id).firstOrFail()

    await client
      .patch(`/fr/quote-cart/items/${item.id}`)
      .withInertia()
      .withCsrfToken()
      .redirects(0)
      .loginAs(owner)
      .json({ quantity: 1200, note: 'Logo deux couleurs' })
    await item.refresh()
    assert.equal(item.quantity, 1200)
    assert.equal(item.note, 'Logo deux couleurs')

    await client
      .delete(`/fr/quote-cart/items/${item.id}`)
      .withInertia()
      .withCsrfToken()
      .redirects(0)
      .loginAs(owner)
    assert.lengthOf(await QuoteCartItem.query().where('userId', owner.id), 0)
  })

  test("la ligne d'un autre panier est un 404", async ({ client, assert }) => {
    const { org, owner } = await buyerWithOwner()
    const colleague = await createMember(org, 'manager')
    const [product] = await productsOfTwoSuppliers()
    await addToCart(client, owner, product.id)
    const item = await QuoteCartItem.query().where('userId', owner.id).firstOrFail()

    const update = await client
      .patch(`/fr/quote-cart/items/${item.id}`)
      .withInertia()
      .withCsrfToken()
      .redirects(0)
      .loginAs(colleague)
      .json({ quantity: 1 })
    const destroy = await client
      .delete(`/fr/quote-cart/items/${item.id}`)
      .withInertia()
      .withCsrfToken()
      .redirects(0)
      .loginAs(colleague)

    update.assertStatus(404)
    destroy.assertStatus(404)
    await item.refresh()
    assert.equal(item.quantity, product.minQuantity ?? 1)
  })

  test("une organisation fournisseuse n'a pas de panier", async ({ client, assert }) => {
    const supplierOrg = await OrganizationFactory.apply('supplier').create()
    const supplierUser = await createMember(supplierOrg, 'owner')
    const [product] = await productsOfTwoSuppliers()

    const page = await client.get('/fr/quote-cart').withInertia().loginAs(supplierUser)
    const add = await addToCart(client, supplierUser, product.id)

    page.assertStatus(403)
    // Formulaire Inertia : un refus Bouncer renvoie d'où l'on vient.
    add.assertStatus(302)
    assert.lengthOf(await QuoteCartItem.query().where('userId', supplierUser.id), 0)

    const catalogue = await client.get('/fr/products').withInertia().loginAs(supplierUser)
    assert.isUndefined(catalogue.inertiaProps.quoteCartCount)
  })
})

test.group('Panier de devis — validation', (checkoutGroup) => {
  useDatabase(checkoutGroup)

  test('crée et envoie une demande par fournisseur, puis vide le panier', async ({
    client,
    assert,
  }) => {
    const { org, owner } = await buyerWithOwner()
    const [first, second] = await productsOfTwoSuppliers()
    await addToCart(client, owner, first.id, 300)
    await addToCart(client, owner, second.id, 500)

    const events = emitter.fake([RfqSent])
    let response
    try {
      response = await checkout(client, owner, {
        title: 'Salon 2027',
        description: 'Goodies pour le stand',
        deadline: '2099-01-31',
      })
      events.assertEmittedCount(RfqSent, 2)
    } finally {
      emitter.restore()
    }

    response.assertStatus(302)
    response.assertHeader('location', '/fr/rfqs')

    const rfqs = await Rfq.query()
      .where('buyerOrganizationId', org.id)
      .preload('items')
      .preload('suppliers', (suppliers) => suppliers.preload('supplierOrganization'))
      .orderBy('id')
    assert.lengthOf(rfqs, 2)

    for (const [rfq, product, quantity] of [
      [rfqs[0], first, 300],
      [rfqs[1], second, 500],
    ] as const) {
      assert.equal(rfq.status, 'published')
      assert.equal(rfq.description, 'Goodies pour le stand')
      assert.equal(rfq.deadline?.setZone(RFQ_DEADLINE_TIMEZONE).toISODate(), '2099-01-31')
      assert.equal(rfq.title, `Salon 2027 — ${rfq.suppliers[0].supplierOrganization.name}`)
      // Chaque fournisseur ne reçoit que sa ligne, et la demande que lui.
      assert.deepEqual(
        rfq.items.map((item) => [item.productId, item.quantity, item.categoryId]),
        [[product.id, quantity, product.categoryId]]
      )
      assert.lengthOf(rfq.suppliers, 1)
      assert.equal(rfq.suppliers[0].supplierOrganizationId, product.supplier.organizationId)
      assert.equal(rfq.suppliers[0].status, 'sent')
    }

    assert.lengthOf(await QuoteCartItem.query().where('userId', owner.id), 0)
  })

  test('un membre envoie ses demandes aux fournisseurs (#216)', async ({ client, assert }) => {
    const { org } = await buyerWithOwner()
    const member = await createMember(org, 'member')
    const [first, second] = await productsOfTwoSuppliers()
    await addToCart(client, member, first.id)
    await addToCart(client, member, second.id)

    const events = emitter.fake([RfqSent])
    try {
      const response = await checkout(client, member, { title: 'Kit onboarding' })
      response.assertStatus(302)
      events.assertEmitted(RfqSent)
    } finally {
      emitter.restore()
    }

    const rfqs = await Rfq.query().where('buyerOrganizationId', org.id).preload('suppliers')
    assert.lengthOf(rfqs, 2)
    assert.isTrue(rfqs.every((rfq) => rfq.status === 'published'))
    assert.isTrue(rfqs.every((rfq) => rfq.suppliers[0].status === 'sent'))
    assert.lengthOf(await QuoteCartItem.query().where('userId', member.id), 0)
  })

  test('le groupe non joignable reste au panier', async ({ client, assert }) => {
    const { org, owner } = await buyerWithOwner()
    const [first, second] = await productsOfTwoSuppliers()
    await addToCart(client, owner, first.id)
    await addToCart(client, owner, second.id)
    await Organization.query()
      .where('id', second.supplier.organizationId!)
      .update({ archivedAt: new Date() })

    const response = await checkout(client, owner, { title: 'Salon 2027' })
    response.assertStatus(302)

    const rfqs = await Rfq.query().where('buyerOrganizationId', org.id).preload('items')
    assert.lengthOf(rfqs, 1)
    assert.equal(rfqs[0].items[0].productId, first.id)
    const left = await QuoteCartItem.query().where('userId', owner.id)
    assert.deepEqual(
      left.map((item) => item.productId),
      [second.id]
    )
  })

  test('un panier sans rien à demander est refusé', async ({ client, assert }) => {
    const { org, owner } = await buyerWithOwner()

    const response = await checkout(client, owner, { title: 'Salon 2027' })

    response.assertStatus(302)
    assert.lengthOf(await Rfq.query().where('buyerOrganizationId', org.id), 0)
  })

  test('un titre manquant est une erreur de validation, rien n’est créé', async ({
    client,
    assert,
  }) => {
    const { org, owner } = await buyerWithOwner()
    const [product] = await productsOfTwoSuppliers()
    await addToCart(client, owner, product.id)

    const response = await checkout(client, owner, { title: '' })

    response.assertStatus(302)
    assert.lengthOf(await Rfq.query().where('buyerOrganizationId', org.id), 0)
    assert.lengthOf(await QuoteCartItem.query().where('userId', owner.id), 1)
  })
})

test.group('Panier de devis — options et prix dégressifs', (optionsGroup) => {
  useDatabase(optionsGroup)

  test('estime la ligne au palier atteint et suit la quantité', async ({ client, assert }) => {
    const { owner } = await buyerWithOwner()
    const { product } = await pricedProduct()
    await addToCart(client, owner, product.id, 200)

    let [group] = await cartGroups(client, owner)
    let [line] = group.items
    assert.equal(line.estimate?.unitPrice, '2.10')
    assert.equal(line.estimate?.total, '420.00')
    assert.equal(line.estimate?.nextTier?.minQuantity, 250)
    assert.deepEqual(group.subtotals, [{ currency: 'EUR', total: '420.00' }])
    assert.isTrue(group.estimateComplete)

    await updateLine(client, owner, line.id, { quantity: 300 }).then((r) => r.assertStatus(303))
    ;[group] = await cartGroups(client, owner)
    ;[line] = group.items
    assert.equal(line.estimate?.unitPrice, '1.85')
    assert.equal(line.estimate?.total, '555.00')
  })

  test('la grille propre à la variante prend le pas', async ({ client, assert }) => {
    const { owner } = await buyerWithOwner()
    const { product, red, blue } = await pricedProduct()
    await addToCart(client, owner, product.id, 100, red.id)
    await addToCart(client, owner, product.id, 100, blue.id)

    const [group] = await cartGroups(client, owner)
    assert.deepEqual(
      group.items.map((line) => [line.variantId, line.estimate?.unitPrice]),
      [
        [red.id, '2.10'],
        [blue.id, '2.50'],
      ]
    )
    assert.deepEqual(group.subtotals, [{ currency: 'EUR', total: '460.00' }])
  })

  test('deux variantes du même produit font deux lignes, la même variante une seule', async ({
    client,
    assert,
  }) => {
    const { owner } = await buyerWithOwner()
    const { product, red, blue } = await pricedProduct()
    await addToCart(client, owner, product.id, 100, red.id)
    await addToCart(client, owner, product.id, 100, red.id)
    await addToCart(client, owner, product.id, 100, blue.id)
    await addToCart(client, owner, product.id)

    const items = await QuoteCartItem.query().where('userId', owner.id).orderBy('id')
    assert.deepEqual(
      items.map((item) => item.variantId),
      [red.id, blue.id, null]
    )

    const page = await client.get(`/fr/products/${product.slug}`).withInertia().loginAs(owner)
    assert.sameMembers(page.inertiaProps.rfqContext.inCartVariantIds, [red.id, blue.id, null])
  })

  test("refuse la variante d'un autre produit ou inactive", async ({ client, assert }) => {
    const { owner } = await buyerWithOwner()
    const { product, red } = await pricedProduct()
    const other = await pricedProduct()
    await red.merge({ isActive: false }).save()

    await addToCart(client, owner, product.id, 100, other.red.id)
    await addToCart(client, owner, product.id, 100, red.id)

    assert.lengthOf(await QuoteCartItem.query().where('userId', owner.id), 0)
  })

  test('le marquage ajoute son prix dégressif et ses frais techniques', async ({
    client,
    assert,
  }) => {
    const { owner } = await buyerWithOwner()
    const { product, marking } = await pricedProduct()
    await addToCart(client, owner, product.id, 250)
    const item = await QuoteCartItem.query().where('userId', owner.id).firstOrFail()

    const response = await updateLine(client, owner, item.id, {
      markingPositionTechniqueId: marking.id,
      markingColors: 2,
    })
    response.assertStatus(303)

    const [group] = await cartGroups(client, owner)
    const [line] = group.items
    // 250 × (1,85 + 0,30) + 45
    assert.equal(line.estimate?.markingUnitPrice, '0.30')
    assert.equal(line.estimate?.setupCharge, '45.00')
    assert.equal(line.estimate?.total, '582.50')
  })

  test('refuse un marquage étranger, trop de couleurs ou des couleurs sans marquage', async ({
    client,
    assert,
  }) => {
    const { owner } = await buyerWithOwner()
    const { product, marking } = await pricedProduct()
    const other = await pricedProduct()
    await addToCart(client, owner, product.id, 250)
    const item = await QuoteCartItem.query().where('userId', owner.id).firstOrFail()

    await updateLine(client, owner, item.id, { markingPositionTechniqueId: other.marking.id })
    await updateLine(client, owner, item.id, { markingColors: 2 })
    await updateLine(client, owner, item.id, {
      markingPositionTechniqueId: marking.id,
      markingColors: 5,
    })

    await item.refresh()
    assert.isNull(item.markingPositionTechniqueId)
    assert.isNull(item.markingColors)

    // Retirer le marquage efface les couleurs.
    await updateLine(client, owner, item.id, {
      markingPositionTechniqueId: marking.id,
      markingColors: 3,
    })
    await updateLine(client, owner, item.id, { markingPositionTechniqueId: null })
    await item.refresh()
    assert.isNull(item.markingPositionTechniqueId)
    assert.isNull(item.markingColors)
  })

  test('changer de variante vers une variante déjà au panier est refusé', async ({
    client,
    assert,
  }) => {
    const { owner } = await buyerWithOwner()
    const { product, red, blue } = await pricedProduct()
    await addToCart(client, owner, product.id, 100, red.id)
    await addToCart(client, owner, product.id, 100, blue.id)
    const redLine = await QuoteCartItem.query()
      .where('userId', owner.id)
      .where('variantId', red.id)
      .firstOrFail()

    const response = await updateLine(client, owner, redLine.id, { variantId: blue.id })
    response.assertStatus(303)

    await redLine.refresh()
    assert.equal(redLine.variantId, red.id)
  })

  test('la validation transmet options et estimation dans les specs', async ({
    client,
    assert,
  }) => {
    const { org, owner } = await buyerWithOwner()
    const { product, blue, marking, technique } = await pricedProduct()
    await addToCart(client, owner, product.id, 100, blue.id)
    const item = await QuoteCartItem.query().where('userId', owner.id).firstOrFail()
    await updateLine(client, owner, item.id, {
      markingPositionTechniqueId: marking.id,
      markingColors: 2,
    })

    emitter.fake([RfqSent])
    try {
      await checkout(client, owner, { title: 'Salon 2027' }).then((r) => r.assertStatus(302))
    } finally {
      emitter.restore()
    }

    const rfq = await Rfq.query()
      .where('buyerOrganizationId', org.id)
      .preload('items')
      .firstOrFail()
    assert.deepEqual(rfq.items[0].specs, {
      variant: blue.sku,
      sku: blue.sku,
      markingPosition: 'Face',
      markingTechnique: technique.slug,
      markingColors: '2',
      estimatedUnitPrice: '2.50 EUR',
      estimatedMarkingUnitPrice: '0.40 EUR',
      estimatedSetupCharge: '45.00 EUR',
      // 100 × (2,50 + 0,40) + 45
      estimatedTotal: '335.00 EUR',
    })
  })

  test('le mail au fournisseur reprend la ligne et le prix indicatif du panier (#219)', async ({
    client,
    assert,
  }) => {
    const { owner } = await buyerWithOwner()
    const { product, blue, marking, technique } = await pricedProduct()
    await product.supplier.organization.merge({ email: 'devis@fournisseur.test' }).save()
    await addToCart(client, owner, product.id, 100, blue.id)
    const item = await QuoteCartItem.query().where('userId', owner.id).firstOrFail()
    await updateLine(client, owner, item.id, {
      markingPositionTechniqueId: marking.id,
      markingColors: 2,
    })

    const { mails } = mail.fake()
    let sent: unknown[]
    try {
      await checkout(client, owner, { title: 'Salon 2027', description: 'Livraison à Lyon' })
      sent = mails.sent((mailer) => mailer instanceof RfqReceivedNotification)
    } finally {
      mail.restore()
    }

    assert.lengthOf(sent, 1)
    const { data } = sent[0] as { data: RfqReceivedMailData }
    const rfqItem = await RfqItem.query().where('productId', product.id).firstOrFail()
    assert.equal(data.description, 'Livraison à Lyon')
    assert.deepEqual(data.lines, [
      {
        name: rfqItem.name,
        reference: blue.sku,
        variant: blue.sku,
        quantity: 100,
        unit: null,
        marking: { position: 'Face', technique: technique.slug, colors: '2' },
        note: null,
        prices: {
          unitPrice: '2.50 EUR',
          markingUnitPrice: '0.40 EUR',
          setupCharge: '45.00 EUR',
          total: '335.00 EUR',
        },
      },
    ])
  })

  test('une ligne sans option ni grille ne porte pas de specs', async ({ client, assert }) => {
    const { org, owner } = await buyerWithOwner()
    const [product] = await productsOfTwoSuppliers()
    await addToCart(client, owner, product.id)

    emitter.fake([RfqSent])
    try {
      await checkout(client, owner, { title: 'Salon 2027' })
    } finally {
      emitter.restore()
    }

    const rfq = await Rfq.query()
      .where('buyerOrganizationId', org.id)
      .preload('items')
      .firstOrFail()
    assert.isNull(rfq.items[0].specs)
  })
})
