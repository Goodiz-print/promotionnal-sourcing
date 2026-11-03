import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import mail from '@adonisjs/mail/services/main'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { QuoteFactory } from '#database/factories/quote_factory'
import { QuoteItemFactory } from '#database/factories/quote_item_factory'
import { RfqFactory } from '#database/factories/rfq_factory'
import { RfqItemFactory } from '#database/factories/rfq_item_factory'
import { RfqSupplierFactory } from '#database/factories/rfq_supplier_factory'
import { UserFactory } from '#database/factories/user_factory'
import RfqReminderNotification from '#mails/rfq_reminder_notification'
import AdminAuditLog from '#models/admin_audit_log'
import Order from '#models/order'
import Quote from '#models/quote'
import type Rfq from '#models/rfq'
import RfqSupplier from '#models/rfq_supplier'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'
import type { AdminRfqDetail, AdminRfqRow } from '#shared/types/admin_trade'

/**
 * Supervision des demandes de devis, devis et commandes par la plateforme (#166).
 */
interface RfqList {
  rfqs: { data: AdminRfqRow[]; meta: { total: number } }
}

async function buyerOrg(name?: string) {
  return OrganizationFactory.merge({
    organizationType: 'buyer',
    ...(name ? { name } : {}),
  }).create()
}

async function supplierOrg(name?: string) {
  return OrganizationFactory.apply('supplier')
    .merge(name ? { name } : {})
    .create()
}

async function buyerId(name?: string) {
  const organization = await buyerOrg(name)
  return organization.id
}

async function supplierId(name?: string) {
  const organization = await supplierOrg(name)
  return organization.id
}

async function publishedRfq(buyer: number, overrides: Partial<Rfq> = {}) {
  // Sans l'état `published` de la fabrique : il écraserait `publishedAt`.
  return RfqFactory.merge({
    buyerOrganizationId: buyer,
    status: 'published',
    publishedAt: DateTime.now(),
    ...overrides,
  }).create()
}

async function recipient(rfqId: number, supplier: number, status: 'sent' | 'viewed' = 'sent') {
  return RfqSupplierFactory.merge({
    rfqId,
    supplierOrganizationId: supplier,
    status,
    sentAt: DateTime.now().minus({ days: 4 }),
  }).create()
}

async function rfqList(client: any, user: unknown, qs = '') {
  const response = await client.get(`/fr/admin/rfqs${qs}`).withInertia().loginAs(user)
  response.assertStatus(200)
  return response.inertiaProps as RfqList
}

async function rfqRows(client: any, user: unknown, qs = '') {
  const result = await rfqList(client, user, qs)
  return result.rfqs.data
}

/** Intervention par JSON : un refus (403) ou un conflit (409) gardent leur statut. */
function intervene(client: any, user: unknown, id: number, action: 'close' | 'expire' | 'remind') {
  return client
    .post(`/fr/admin/rfqs/${id}/${action}`)
    .redirects(0)
    .withCsrfToken()
    .header('Accept', 'application/json')
    .loginAs(user)
}

test.group('Supervision — droits', (group) => {
  useDatabase(group)

  test('admin, support et analyste lisent les trois listes, pas le modérateur', async ({
    client,
  }) => {
    for (const role of ['platformAdmin', 'platformSupport', 'platformAnalyst'] as const) {
      const user = await UserFactory.apply(role).create()
      for (const path of ['rfqs', 'quotes', 'orders']) {
        const response = await client.get(`/fr/admin/${path}`).withInertia().loginAs(user)
        response.assertStatus(200)
        response.assertInertiaComponent(`admin/${path}/index`)
      }
    }

    const moderator = await UserFactory.apply('platformModerator').create()
    const refused = await client.get('/fr/admin/rfqs').withInertia().loginAs(moderator)
    refused.assertStatus(403)
  })

  test('seul l’admin intervient sur une demande', async ({ client, assert }) => {
    const rfq = await publishedRfq(await buyerId())

    for (const role of ['platformSupport', 'platformAnalyst', 'platformModerator'] as const) {
      const user = await UserFactory.apply(role).create()
      for (const action of ['close', 'expire', 'remind'] as const) {
        const response = await intervene(client, user, rfq.id, action)
        response.assertStatus(403)
      }
    }

    await rfq.refresh()
    assert.equal(rfq.status, 'published')
    assert.lengthOf(await AdminAuditLog.all(), 0)
  })

  test('un compte sans rôle plateforme n’accède à rien', async ({ client }) => {
    const user = await UserFactory.create()
    const response = await client.get('/fr/admin/rfqs').withInertia().loginAs(user)
    response.assertStatus(403)
  })
})

test.group('Supervision — liste des demandes', (group) => {
  useDatabase(group)

  test('liste toutes les organisations, filtre par statut, acheteur et fournisseur', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const acme = await buyerOrg('Acme Agency')
    const other = await buyerOrg('Beta Studio')
    const first = await publishedRfq(acme.id)
    const second = await RfqFactory.merge({ buyerOrganizationId: other.id }).create()
    await recipient(first.id, await supplierId('Goodies Corp'))
    await recipient(second.id, await supplierId('Textiles SA'))

    assert.lengthOf(await rfqRows(client, admin), 2)

    const byStatus = await rfqList(client, admin, '?status=published')
    assert.deepEqual(
      byStatus.rfqs.data.map((row) => row.id),
      [first.id]
    )

    const byBuyer = await rfqList(client, admin, '?buyer=beta')
    assert.deepEqual(
      byBuyer.rfqs.data.map((row) => row.id),
      [second.id]
    )

    const bySupplier = await rfqList(client, admin, '?supplier=goodies')
    assert.deepEqual(
      bySupplier.rfqs.data.map((row) => row.id),
      [first.id]
    )
  })

  test('un terme de recherche contenant % ou _ est cherché tel quel', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await publishedRfq(await buyerId('Acme'))

    assert.lengthOf(await rfqRows(client, admin, '?buyer=%25'), 0)
    assert.lengthOf(await rfqRows(client, admin, '?buyer=_cme'), 0)
  })

  test('filtre par période de création, bornes incluses', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const buyer = await buyerOrg()
    const old = await RfqFactory.merge({
      buyerOrganizationId: buyer.id,
      createdAt: DateTime.fromISO('2026-01-10T23:30:00'),
    }).create()
    await RfqFactory.merge({
      buyerOrganizationId: buyer.id,
      createdAt: DateTime.fromISO('2026-03-01T10:00:00'),
    }).create()

    const result = await rfqList(client, admin, '?from=2026-01-10&to=2026-01-10')

    assert.deepEqual(
      result.rfqs.data.map((row) => row.id),
      [old.id]
    )
  })

  test('une valeur de filtre invalide est refusée', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await client
      .get('/fr/admin/rfqs?status=nope')
      .header('Accept', 'application/json')
      .loginAs(admin)

    response.assertStatus(422)
  })

  test('repère les demandes bloquées : échéance passée et aucune réponse', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const buyer = await buyerOrg()
    const overdue = await publishedRfq(buyer.id, {
      deadline: DateTime.now().minus({ days: 2 }),
      publishedAt: DateTime.now().minus({ days: 10 }),
    })
    const silent = await publishedRfq(buyer.id, {
      deadline: DateTime.now().plus({ days: 20 }),
      publishedAt: DateTime.now().minus({ days: 10 }),
    })
    const answered = await publishedRfq(buyer.id, {
      deadline: DateTime.now().plus({ days: 20 }),
      publishedAt: DateTime.now().minus({ days: 10 }),
    })
    await QuoteFactory.apply('submitted')
      .merge({ rfqId: answered.id, supplierOrganizationId: await supplierId() })
      .create()
    const recent = await publishedRfq(buyer.id, { publishedAt: DateTime.now().minus({ days: 1 }) })

    const all = await rfqList(client, admin)
    const flag = (id: number) => all.rfqs.data.find((row) => row.id === id)?.attention
    assert.equal(flag(overdue.id), 'overdue')
    assert.equal(flag(silent.id), 'no_response')
    assert.isNull(flag(answered.id))
    assert.isNull(flag(recent.id))

    const onlyOverdue = await rfqList(client, admin, '?attention=overdue')
    assert.deepEqual(
      onlyOverdue.rfqs.data.map((row) => row.id),
      [overdue.id]
    )
    const onlySilent = await rfqList(client, admin, '?attention=no_response')
    assert.deepEqual(
      onlySilent.rfqs.data.map((row) => row.id),
      [silent.id]
    )
  })
})

test.group('Supervision — fiches', (group) => {
  useDatabase(group)

  test('la fiche d’une demande liste lignes, destinataires et devis', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const rfq = await publishedRfq(await buyerId())
    await RfqItemFactory.merge({ rfqId: rfq.id }).create()
    const supplier = await supplierOrg('Goodies Corp')
    await recipient(rfq.id, supplier.id)
    await QuoteFactory.apply('submitted')
      .merge({ rfqId: rfq.id, supplierOrganizationId: supplier.id })
      .create()

    const response = await client.get(`/fr/admin/rfqs/${rfq.id}`).withInertia().loginAs(admin)

    response.assertStatus(200)
    response.assertInertiaComponent('admin/rfqs/show')
    const { detail } = response.inertiaProps as { detail: AdminRfqDetail }
    assert.lengthOf(detail.items, 1)
    assert.equal(detail.recipients[0].supplier.name, 'Goodies Corp')
    assert.lengthOf(detail.quotes, 1)
    assert.isTrue(detail.canClose)
    assert.equal(detail.remindableCount, 1)
  })

  test('une demande, un devis ou une commande inconnus répondent 404', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    for (const path of ['rfqs', 'quotes', 'orders']) {
      const response = await client.get(`/fr/admin/${path}/999999`).withInertia().loginAs(admin)
      response.assertStatus(404)
    }
  })
})

test.group('Supervision — interventions', (group) => {
  useDatabase(group)

  test('clôturer une demande publiée la ferme et trace l’action', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const rfq = await publishedRfq(await buyerId())

    const response = await intervene(client, admin, rfq.id, 'close')

    response.assertStatus(302)
    await rfq.refresh()
    assert.equal(rfq.status, 'closed')
    assert.isNotNull(rfq.closedAt)
    const [log] = await AdminAuditLog.all()
    assert.equal(log.action, 'rfq.closed')
    assert.equal(log.targetType, 'rfq')
    assert.equal(log.targetId, rfq.id)
    assert.equal(log.actorEmail, admin.email)
    assert.deepEqual(log.changes, { before: { status: 'published' }, after: { status: 'closed' } })
  })

  test('une demande déjà fermée ne peut plus l’être et n’écrit aucune trace', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const rfq = await RfqFactory.merge({
      buyerOrganizationId: await buyerId(),
      status: 'closed',
    }).create()

    const response = await intervene(client, admin, rfq.id, 'close')

    response.assertStatus(422)
    assert.lengthOf(await AdminAuditLog.all(), 0)
  })

  test('faire expirer une demande l’expire, ainsi que ses devis ouverts', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const rfq = await publishedRfq(await buyerId())
    const quote = await QuoteFactory.apply('submitted')
      .merge({ rfqId: rfq.id, supplierOrganizationId: await supplierId() })
      .create()

    const response = await intervene(client, admin, rfq.id, 'expire')

    response.assertStatus(302)
    await rfq.refresh()
    await quote.refresh()
    assert.equal(rfq.status, 'expired')
    assert.isNotNull(rfq.expiredAt)
    assert.equal(quote.status, 'expired')
    const [log] = await AdminAuditLog.all()
    assert.equal(log.action, 'rfq.expired')
  })

  test('une demande introuvable répond 404', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await intervene(client, admin, 999999, 'close')

    response.assertStatus(404)
  })

  test('relancer écrit à chaque destinataire sans réponse, une seule fois', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const rfq = await publishedRfq(await buyerId())
    const silent = await supplierOrg()
    await createMember(silent, 'owner')
    await recipient(rfq.id, silent.id)
    const answered = await supplierOrg()
    await createMember(answered, 'owner')
    await RfqSupplierFactory.merge({
      rfqId: rfq.id,
      supplierOrganizationId: answered.id,
      status: 'responded',
    }).create()

    const { mails } = mail.fake()
    try {
      const first = await intervene(client, admin, rfq.id, 'remind')
      first.assertStatus(302)
      assert.lengthOf(
        mails.sent((mailer) => mailer instanceof RfqReminderNotification),
        1
      )

      const second = await intervene(client, admin, rfq.id, 'remind')
      second.assertStatus(409)
      assert.lengthOf(
        mails.sent((mailer) => mailer instanceof RfqReminderNotification),
        1
      )
    } finally {
      mail.restore()
    }

    const rows = await RfqSupplier.query().where('rfqId', rfq.id).orderBy('id')
    assert.isNotNull(rows[0].remindedAt)
    assert.isNull(rows[1].remindedAt)
    const logs = await AdminAuditLog.all()
    assert.lengthOf(logs, 1)
    assert.equal(logs[0].action, 'rfq.reminded')
    assert.deepEqual(logs[0].changes, { after: { recipients: 1, reminded: 1 } })
  })

  test('relancer une demande qui n’attend plus de réponse est refusé', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const rfq = await RfqFactory.merge({
      buyerOrganizationId: await buyerId(),
      status: 'closed',
    }).create()
    await recipient(rfq.id, await supplierId())

    const response = await intervene(client, admin, rfq.id, 'remind')

    response.assertStatus(409)
    assert.lengthOf(await AdminAuditLog.all(), 0)
    assert.lengthOf(await Quote.all(), 0)
  })
})

test.group('Supervision — devis et commandes', (group) => {
  useDatabase(group)

  test('liste les devis de toutes les organisations, filtrés par statut et fournisseur', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const rfq = await publishedRfq(await buyerId('Acme Agency'))
    const goodies = await supplierId('Goodies Corp')
    const submitted = await QuoteFactory.apply('submitted')
      .merge({ rfqId: rfq.id, supplierOrganizationId: goodies, totalAmount: '120.50' })
      .create()
    await QuoteFactory.merge({ rfqId: rfq.id, supplierOrganizationId: await supplierId() }).create()

    const all = await client.get('/fr/admin/quotes').withInertia().loginAs(admin)
    const { quotes } = all.inertiaProps as { quotes: { data: { id: number }[] } }
    assert.lengthOf(quotes.data, 2)

    const filtered = await client
      .get('/fr/admin/quotes?status=submitted&supplier=goodies&buyer=acme')
      .withInertia()
      .loginAs(admin)
    const { quotes: result } = filtered.inertiaProps as {
      quotes: { data: { id: number; totalAmount: string }[] }
    }
    assert.deepEqual(
      result.data.map((row) => row.id),
      [submitted.id]
    )
    assert.equal(result.data[0].totalAmount, '120.50')
  })

  test('la fiche d’un devis donne ses lignes', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const rfq = await publishedRfq(await buyerId())
    const item = await RfqItemFactory.merge({ rfqId: rfq.id }).create()
    const quote = await QuoteFactory.apply('submitted')
      .merge({ rfqId: rfq.id, supplierOrganizationId: await supplierId() })
      .create()
    await QuoteItemFactory.merge({ quoteId: quote.id, rfqItemId: item.id }).create()

    const response = await client.get(`/fr/admin/quotes/${quote.id}`).withInertia().loginAs(admin)

    response.assertStatus(200)
    response.assertInertiaComponent('admin/quotes/show')
    const { detail } = response.inertiaProps as {
      detail: { items: { rfqItemName: string }[]; orderId: number | null }
    }
    assert.lengthOf(detail.items, 1)
    assert.equal(detail.items[0].rfqItemName, item.name)
    assert.isNull(detail.orderId)
  })

  test('liste et détaille les commandes, filtrées par statut', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const buyer = await buyerId('Acme Agency')
    const supplier = await supplierId()
    const rfq = await publishedRfq(buyer)
    const quote = await QuoteFactory.apply('accepted')
      .merge({ rfqId: rfq.id, supplierOrganizationId: supplier })
      .create()
    const order = await Order.create({
      quoteId: quote.id,
      buyerOrganizationId: buyer,
      supplierOrganizationId: supplier,
      status: 'confirmed',
      currency: 'EUR',
      totalAmount: '300.00',
    })

    const list = await client
      .get('/fr/admin/orders?status=confirmed&buyer=acme')
      .withInertia()
      .loginAs(admin)
    const { orders } = list.inertiaProps as { orders: { data: { id: number }[] } }
    assert.deepEqual(
      orders.data.map((row) => row.id),
      [order.id]
    )

    const none = await client.get('/fr/admin/orders?status=delivered').withInertia().loginAs(admin)
    const { orders: empty } = none.inertiaProps as { orders: { data: unknown[] } }
    assert.lengthOf(empty.data, 0)

    const detail = await client.get(`/fr/admin/orders/${order.id}`).withInertia().loginAs(admin)
    detail.assertStatus(200)
    detail.assertInertiaComponent('admin/orders/show')

    const quoteDetail = await client
      .get(`/fr/admin/quotes/${quote.id}`)
      .withInertia()
      .loginAs(admin)
    const { detail: found } = quoteDetail.inertiaProps as { detail: { orderId: number | null } }
    assert.equal(found.orderId, order.id)
  })
})

test.group('Supervision — validation et fuseau', (group) => {
  useDatabase(group)

  test('une page décimale ou démesurée est refusée en 422, pas en 500', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    for (const page of ['1.5', '0', '99999999999']) {
      const response = await client
        .get(`/fr/admin/rfqs?page=${page}`)
        .header('Accept', 'application/json')
        .loginAs(admin)
      response.assertStatus(422)
    }
  })

  test('la période se lit en jours de Paris', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const buyer = await buyerId()
    // 00h30 à Paris le 1er novembre = 23h30 UTC le 31 octobre.
    const lateNight = await RfqFactory.merge({
      buyerOrganizationId: buyer,
      createdAt: DateTime.fromISO('2026-11-01T00:30:00', { zone: 'Europe/Paris' }),
    }).create()

    const inside = await rfqRows(client, admin, '?from=2026-11-01&to=2026-11-01')
    const before = await rfqRows(client, admin, '?from=2026-10-31&to=2026-10-31')

    assert.deepEqual(
      inside.map((row) => row.id),
      [lateNight.id]
    )
    assert.lengthOf(before, 0)
  })

  test('deux interventions simultanées ne s’écrasent pas : la seconde reçoit 422', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const rfq = await publishedRfq(await buyerId())

    const [first, second] = await Promise.all([
      intervene(client, admin, rfq.id, 'close'),
      intervene(client, admin, rfq.id, 'expire'),
    ])

    assert.sameMembers([first.status(), second.status()], [302, 422])
    await rfq.refresh()
    assert.include(['closed', 'expired'], rfq.status)
    assert.lengthOf(await AdminAuditLog.all(), 1)
  })
})
