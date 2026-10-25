import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import mail from '@adonisjs/mail/services/main'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { QuoteFactory } from '#database/factories/quote_factory'
import { QuoteItemFactory } from '#database/factories/quote_item_factory'
import { RfqFactory } from '#database/factories/rfq_factory'
import { RfqItemFactory } from '#database/factories/rfq_item_factory'
import { RfqSupplierFactory } from '#database/factories/rfq_supplier_factory'
import Notification from '#models/notification'
import Order from '#models/order'
import OrderItem from '#models/order_item'
import OrderService from '#services/order_service'
import QuoteService from '#services/quote_service'
import NotificationTransformer from '#transformers/notification_transformer'
import {
  OrderNotCreatableException,
  OrderNotFoundException,
  OrderTransitionException,
} from '#exceptions/order_errors'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'
import type User from '#models/user'
import type { OrderAction } from '#shared/types/order'

/**
 * Commandes (#6) : née de l'acceptation d'un devis, pilotée par le fournisseur
 * (confirmer, produire, expédier), clôturée par l'acheteur (réception).
 */
function fakeMails(group: Parameters<typeof useDatabase>[0]) {
  group.each.setup(() => {
    mail.fake()
    return () => mail.restore()
  })
}

async function notificationsOf(user: User, prefix = 'order.'): Promise<Notification[]> {
  const all = await Notification.query().where('userId', user.id).orderBy('id')
  return all.filter((notification) => notification.type.startsWith(prefix))
}

async function typesOf(user: User, prefix = 'order.'): Promise<string[]> {
  const notifications = await notificationsOf(user, prefix)
  return notifications.map((notification) => notification.type)
}

/** Acheteur (avec adresse) et fournisseur, une demande de deux items et un devis remis. */
async function scenario() {
  const buyer = await OrganizationFactory.merge({
    name: 'Acme Marketing',
    addressLine1: '1 rue de la Paix',
    postalCode: '75002',
    city: 'Paris',
  }).create()
  const buyerOwner = await createMember(buyer, 'owner')
  const buyerMember = await createMember(buyer, 'member')
  const supplier = await OrganizationFactory.apply('supplier').create()
  const supplierOwner = await createMember(supplier, 'owner')
  const supplierMember = await createMember(supplier, 'member')

  const rfq = await RfqFactory.apply('published').merge({ buyerOrganizationId: buyer.id }).create()
  const tote = await RfqItemFactory.merge({
    rfqId: rfq.id,
    name: 'Tote bag',
    quantity: 500,
  }).create()
  const mug = await RfqItemFactory.merge({ rfqId: rfq.id, name: 'Mug', quantity: 200 }).create()
  await RfqSupplierFactory.merge({
    rfqId: rfq.id,
    supplierOrganizationId: supplier.id,
    status: 'viewed',
    sentAt: DateTime.now(),
  }).create()

  const quotes = await app.container.make(QuoteService)
  const orders = await app.container.make(OrderService)
  return {
    buyer,
    buyerOwner,
    buyerMember,
    supplier,
    supplierOwner,
    supplierMember,
    rfq,
    tote,
    mug,
    quotes,
    orders,
  }
}

/** Parcours complet jusqu'à l'acceptation : la commande est créée par le listener. */
async function acceptedOrder() {
  const ctx = await scenario()
  const draft = await ctx.quotes.createDraft(ctx.rfq.id, ctx.supplier.id, {
    notes: 'Franco de port',
    items: [
      { rfqItemId: ctx.tote.id, unitPrice: 1.2345, quantity: 100, leadTimeDays: 15 },
      {
        rfqItemId: ctx.mug.id,
        unitPrice: 3,
        quantity: 3,
        leadTimeDays: 30,
        customizationDetails: { note: 'Logo 1 couleur' },
      },
    ],
  })
  const quote = await ctx.quotes.submit(draft)
  await ctx.quotes.accept(quote)
  const order = await Order.findByOrFail('quoteId', quote.id)
  return { ...ctx, quote, order }
}

/** Amène la commande dans un statut donné par le chemin nominal. */
async function advance(orders: OrderService, order: Order, upTo: OrderAction[]) {
  for (const action of upTo) {
    await orders.transition(order, action, action === 'deliver' ? 'buyer' : 'supplier')
  }
}

test.group('Commandes — création', (group) => {
  useDatabase(group)
  fakeMails(group)

  test('accepter un devis crée la commande, ses lignes et des adresses figées', async ({
    assert,
  }) => {
    const { order, quote, buyer, supplier } = await acceptedOrder()

    assert.equal(order.status, 'pending')
    assert.equal(order.buyerOrganizationId, buyer.id)
    assert.equal(order.supplierOrganizationId, supplier.id)
    assert.equal(order.totalAmount, quote.totalAmount)
    assert.equal(order.totalAmount, '132.45')
    assert.equal(order.currency, 'EUR')
    assert.deepInclude(order.shippingAddress!, {
      name: 'Acme Marketing',
      line1: '1 rue de la Paix',
      postalCode: '75002',
      city: 'Paris',
      country: 'FR',
    })
    assert.deepEqual(order.billingAddress, order.shippingAddress)

    const items = await OrderItem.query().where('orderId', order.id).orderBy('id')
    assert.deepEqual(
      items.map((item) => [item.name, item.quantity, item.unitPrice, item.totalPrice]),
      [
        ['Tote bag', 100, '1.2345', '123.45'],
        ['Mug', 3, '3.0000', '9.00'],
      ]
    )
    assert.deepEqual(items[1].customizationDetails, { note: 'Logo 1 couleur' })
  })

  test('les adresses ne suivent pas une modification ultérieure de l’organisation', async ({
    assert,
  }) => {
    const { order, buyer } = await acceptedOrder()

    await buyer.merge({ city: 'Lyon' }).save()

    await order.refresh()
    assert.equal(order.shippingAddress?.city, 'Paris')
  })

  test('est idempotente : rejouer la création renvoie la même commande, sans nouvelle notification', async ({
    assert,
  }) => {
    const { order, quote, orders, supplierOwner } = await acceptedOrder()

    const again = await orders.createFromQuote(quote)

    assert.equal(again.id, order.id)
    assert.equal(
      await Order.query()
        .where('quoteId', quote.id)
        .count('* as n')
        .then(([r]) => Number(r.$extras.n)),
      1
    )
    assert.lengthOf(await notificationsOf(supplierOwner, 'order.created'), 1)
  })

  test('un devis qui n’est pas accepté ne donne pas de commande', async ({ assert }) => {
    const { orders, rfq, supplier } = await scenario()
    const quote = await QuoteFactory.apply('submitted')
      .merge({ rfqId: rfq.id, supplierOrganizationId: supplier.id })
      .create()
    await QuoteItemFactory.merge({ quoteId: quote.id, rfqItemId: 1 }).make()

    await assert.rejects(() => orders.createFromQuote(quote), OrderNotCreatableException.message)
  })

  test('prévient les responsables du fournisseur, pas un simple membre', async ({ assert }) => {
    const { supplierOwner, supplierMember, buyerOwner, order, rfq } = await acceptedOrder()

    const [notification] = await notificationsOf(supplierOwner, 'order.created')
    assert.deepInclude(notification.data, {
      orderId: order.id,
      rfqTitle: rfq.title,
      side: 'supplier',
    })
    assert.lengthOf(await notificationsOf(supplierMember), 0)
    assert.lengthOf(await notificationsOf(buyerOwner), 0)
  })
})

test.group('Commandes — transitions', (group) => {
  useDatabase(group)
  fakeMails(group)

  test('parcourt confirmée → en production → expédiée → livrée, avec la date de chaque étape', async ({
    assert,
  }) => {
    const { orders, order } = await acceptedOrder()

    await orders.transition(order, 'confirm', 'supplier')
    assert.equal(order.status, 'confirmed')
    assert.isNotNull(order.confirmedAt)

    await orders.transition(order, 'startProduction', 'supplier')
    assert.equal(order.status, 'in_production')
    assert.isNotNull(order.inProductionAt)

    await orders.transition(order, 'ship', 'supplier')
    assert.equal(order.status, 'shipped')
    assert.isNotNull(order.shippedAt)

    await orders.transition(order, 'deliver', 'buyer')
    assert.equal(order.status, 'delivered')
    assert.isNotNull(order.deliveredAt)
    assert.isNull(order.cancelledAt)
  })

  test('refuse une étape sautée ou rejouée', async ({ assert }) => {
    const { orders, order } = await acceptedOrder()

    await assert.rejects(
      () => orders.transition(order, 'ship', 'supplier'),
      OrderTransitionException.message
    )
    await orders.transition(order, 'confirm', 'supplier')
    await assert.rejects(
      () => orders.transition(order, 'confirm', 'supplier'),
      OrderTransitionException.message
    )
    await order.refresh()
    assert.equal(order.status, 'confirmed')
  })

  test('chaque côté n’a que ses propres actions', async ({ assert }) => {
    const { orders, order } = await acceptedOrder()
    await advance(orders, order, ['confirm', 'startProduction', 'ship'])

    // L'acheteur ne fait pas avancer la production ; le fournisseur ne s'auto-livre pas.
    await assert.rejects(
      () => orders.transition(order, 'ship', 'buyer'),
      OrderTransitionException.message
    )
    await assert.rejects(
      () => orders.transition(order, 'deliver', 'supplier'),
      OrderTransitionException.message
    )
    assert.deepEqual(orders.availableActions(order, 'buyer'), ['deliver'])
    assert.deepEqual(orders.availableActions(order, 'supplier'), [])
  })

  test('une commande s’annule tant qu’elle n’est pas en production, pas après', async ({
    assert,
  }) => {
    const { orders, order } = await acceptedOrder()
    await orders.transition(order, 'confirm', 'supplier')
    assert.includeMembers(orders.availableActions(order, 'buyer'), ['cancel'])

    await orders.transition(order, 'startProduction', 'supplier')
    await assert.rejects(
      () => orders.transition(order, 'cancel', 'buyer'),
      OrderTransitionException.message
    )

    const { orders: otherOrders, order: pending } = await acceptedOrder()
    await otherOrders.transition(pending, 'cancel', 'buyer')
    assert.equal(pending.status, 'cancelled')
    assert.isNotNull(pending.cancelledAt)
    assert.deepEqual(otherOrders.availableActions(pending, 'supplier'), [])
  })

  test('l’acheteur suit l’avancement par notification ; le fournisseur apprend la livraison', async ({
    assert,
  }) => {
    const { orders, order, buyerOwner, buyerMember, supplierOwner } = await acceptedOrder()

    await advance(orders, order, ['confirm', 'startProduction', 'ship', 'deliver'])

    assert.deepEqual(await typesOf(buyerOwner), [
      'order.confirmed',
      'order.in_production',
      'order.shipped',
    ])
    assert.deepEqual(await typesOf(supplierOwner), ['order.created', 'order.delivered'])
    assert.lengthOf(await notificationsOf(buyerMember), 0)
  })

  test('une annulation prévient l’autre côté, pas son auteur', async ({ assert }) => {
    const { orders, order, buyerOwner, supplierOwner } = await acceptedOrder()

    await orders.transition(order, 'cancel', 'supplier')

    assert.deepEqual(await typesOf(buyerOwner), ['order.cancelled'])
    assert.deepEqual(await typesOf(supplierOwner), ['order.created'])
  })

  test('le lien de la notification mène à l’écran du côté du destinataire', async ({ assert }) => {
    const { orders, order, buyerOwner, supplierOwner } = await acceptedOrder()
    await orders.transition(order, 'confirm', 'supplier')

    const [forSupplier] = await notificationsOf(supplierOwner, 'order.created')
    const [forBuyer] = await notificationsOf(buyerOwner, 'order.confirmed')

    assert.equal(
      new NotificationTransformer(forSupplier, 'fr').toObject().href,
      `/fr/supplier/orders/${order.id}`
    )
    assert.equal(
      new NotificationTransformer(forBuyer, 'fr').toObject().href,
      `/fr/orders/${order.id}`
    )
  })
})

test.group('Commandes — cloisonnement', (group) => {
  useDatabase(group)
  fakeMails(group)

  test('la commande d’une autre organisation est introuvable, des deux côtés', async ({
    assert,
  }) => {
    const { orders, order, buyer, supplier } = await acceptedOrder()
    const stranger = await OrganizationFactory.create()

    await assert.rejects(
      () => orders.findFor('buyer', order.id, stranger.id),
      OrderNotFoundException.message
    )
    await assert.rejects(
      () => orders.findFor('supplier', order.id, stranger.id),
      OrderNotFoundException.message
    )
    // L'acheteur n'est pas le fournisseur : chaque côté a sa propre clé.
    await assert.rejects(
      () => orders.findFor('supplier', order.id, buyer.id),
      OrderNotFoundException.message
    )
    await assert.rejects(
      () => orders.findFor('buyer', order.id, supplier.id),
      OrderNotFoundException.message
    )
  })
})

test.group('Commandes — écrans', (group) => {
  useDatabase(group)
  fakeMails(group)

  test('l’acheteur retrouve la commande dans son historique et la fournit au devis accepté', async ({
    client,
    assert,
  }) => {
    const { buyerOwner, order, quote } = await acceptedOrder()

    const list = await client.get('/fr/orders').withInertia().loginAs(buyerOwner)
    list.assertInertiaComponent('orders/index')
    assert.deepEqual(
      list.inertiaProps.orders.map((item: { id: number }) => item.id),
      [order.id]
    )

    const detail = await client.get(`/fr/orders/${order.id}`).withInertia().loginAs(buyerOwner)
    detail.assertInertiaComponent('orders/show')
    assert.equal(detail.inertiaProps.order.items.length, 2)
    assert.equal(detail.inertiaProps.order.totalAmount, 132.45)
    assert.deepEqual(detail.inertiaProps.order.actions, ['cancel'])

    const quotePage = await client.get(`/fr/quotes/${quote.id}`).withInertia().loginAs(buyerOwner)
    assert.equal(quotePage.inertiaProps.orderId, order.id)
  })

  test('le fournisseur confirme puis expédie ; l’acheteur confirme la réception', async ({
    client,
    assert,
  }) => {
    const { buyerOwner, supplierOwner, order } = await acceptedOrder()

    const list = await client.get('/fr/supplier/orders').withInertia().loginAs(supplierOwner)
    list.assertInertiaComponent('supplier/orders/index')
    assert.deepEqual(list.inertiaProps.orders[0].actions, ['confirm', 'cancel'])

    for (const step of ['confirm', 'produce', 'ship']) {
      await client
        .patch(`/fr/supplier/orders/${order.id}/${step}`)
        .withInertia()
        .withCsrfToken()
        .loginAs(supplierOwner)
    }
    await order.refresh()
    assert.equal(order.status, 'shipped')

    const detail = await client.get(`/fr/orders/${order.id}`).withInertia().loginAs(buyerOwner)
    assert.deepEqual(detail.inertiaProps.order.actions, ['deliver'])

    await client
      .patch(`/fr/orders/${order.id}/deliver`)
      .withInertia()
      .withCsrfToken()
      .loginAs(buyerOwner)
    await order.refresh()
    assert.equal(order.status, 'delivered')
  })

  test('une action hors statut devient un message, la commande ne bouge pas', async ({
    client,
    assert,
  }) => {
    const { supplierOwner, order } = await acceptedOrder()

    await client
      .patch(`/fr/supplier/orders/${order.id}/ship`)
      .withInertia()
      .withCsrfToken()
      .loginAs(supplierOwner)

    await order.refresh()
    assert.equal(order.status, 'pending')
  })

  test('l’acheteur n’accède pas aux écrans fournisseur, ni un étranger à la commande', async ({
    client,
    assert,
  }) => {
    const { buyerOwner, buyerMember, order } = await acceptedOrder()
    const stranger = await createMember(await OrganizationFactory.create(), 'owner')

    const screen = await client.get('/fr/supplier/orders').withInertia().loginAs(buyerOwner)
    screen.assertStatus(403)

    // Sur une soumission, Bouncer renvoie l'utilisateur d'où il vient avec un
    // message plutôt qu'une page 403 : la commande, elle, ne bouge pas.
    const asBuyer = await client
      .patch(`/fr/supplier/orders/${order.id}/confirm`)
      .withInertia()
      .withCsrfToken()
      .redirects(0)
      .loginAs(buyerOwner)
    asBuyer.assertStatus(303)

    const hidden = await client.get(`/fr/orders/${order.id}`).withInertia().loginAs(stranger)
    hidden.assertStatus(404)

    // Un simple membre consulte mais n'agit pas.
    const member = await client
      .patch(`/fr/orders/${order.id}/cancel`)
      .withInertia()
      .withCsrfToken()
      .redirects(0)
      .loginAs(buyerMember)
    member.assertStatus(303)

    await order.refresh()
    assert.equal(order.status, 'pending')
  })
})
