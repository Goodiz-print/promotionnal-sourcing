import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { UserFactory } from '#database/factories/user_factory'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { QuoteFactory } from '#database/factories/quote_factory'
import { RfqFactory } from '#database/factories/rfq_factory'
import { RfqSupplierFactory } from '#database/factories/rfq_supplier_factory'
import Order from '#models/order'
import Organization from '#models/organization'
import Product from '#models/product'
import Rfq from '#models/rfq'
import User from '#models/user'
import { createOrganizationWithOwner } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'

test.group('Back-office — tableau de bord', (group) => {
  useDatabase(group, { seed: 'full' })

  test('affiche les compteurs plateforme', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await OrganizationFactory.apply('archived').create()
    const { organization } = await createOrganizationWithOwner()
    await RfqFactory.merge({ buyerOrganizationId: organization.id }).create()

    const response = await client.get('/fr/admin').withInertia().loginAs(admin)

    response.assertStatus(200)
    response.assertInertiaComponent('admin/dashboard')

    const total = async (query: {
      count: (column: string) => { firstOrFail: () => Promise<{ $extras: { total?: unknown } }> }
    }) => {
      const row = await query.count('* as total').firstOrFail()
      return Number(row.$extras.total)
    }
    const stats = response.inertiaProps.stats
    assert.equal(stats.organizations, await total(Organization.query().whereNull('archivedAt')))
    assert.equal(stats.archivedOrganizations, 1)
    assert.equal(stats.users, await total(User.query()))
    assert.equal(stats.products, await total(Product.query()))
    assert.equal(stats.rfqs, await total(Rfq.query()))
    assert.isAbove(stats.products, 0)
    assert.isAtLeast(stats.pendingModeration, stats.products)
    assert.isAtLeast(stats.rfqs, 1)
  })
})

/** Midi du jour situé à `daysBefore` jours avant `end` (fin de la période testée). */
function at(end: DateTime, daysBefore: number, hours = 12): DateTime {
  return end.minus({ days: daysBefore }).set({ hour: hours })
}

/** Force des dates d'une ligne (les horodatages automatiques valent « maintenant »). */
async function setDates(table: string, id: number, dates: Record<string, DateTime>) {
  await db
    .from(table)
    .where('id', id)
    .update(Object.fromEntries(Object.entries(dates).map(([key, value]) => [key, value.toSQL()])))
}

test.group('Back-office — indicateurs KPI', (group) => {
  useDatabase(group, { seed: 'full' })

  /**
   * Période de 10 jours qui se termine 5 jours avant aujourd'hui (les lignes
   * créées par les factories et le seed valent « maintenant » : hors période) ;
   * la période précédente couvre les 10 jours d'avant.
   */
  const end = DateTime.now().startOf('day').minus({ days: 5 })
  const query = `from=${end.minus({ days: 9 }).toISODate()}&to=${end.toISODate()}`

  async function scenario() {
    const buyer = await OrganizationFactory.merge({ organizationType: 'buyer' }).create()
    const supplierA = await OrganizationFactory.merge({ organizationType: 'supplier' }).create()
    const supplierB = await OrganizationFactory.merge({ organizationType: 'supplier' }).create()
    const supplierC = await OrganizationFactory.merge({ organizationType: 'supplier' }).create()
    await setDates('organizations', buyer.id, { created_at: at(end, 2) })
    await setDates('organizations', supplierA.id, { created_at: at(end, 3) })
    await setDates('organizations', supplierB.id, { created_at: at(end, 12) })

    const newcomer = await UserFactory.create()
    const returning = await UserFactory.create()
    await setDates('users', newcomer.id, { created_at: at(end, 1), last_login_at: at(end, 1) })
    await setDates('users', returning.id, { last_login_at: at(end, 4) })

    // Demande publiée 6 h après sa création, et un brouillon ; une demande antérieure.
    const published = await RfqFactory.apply('published')
      .merge({ buyerOrganizationId: buyer.id })
      .create()
    await setDates('rfqs', published.id, {
      created_at: at(end, 2, 6),
      published_at: at(end, 2, 12),
    })
    const draft = await RfqFactory.merge({ buyerOrganizationId: buyer.id }).create()
    await setDates('rfqs', draft.id, { created_at: at(end, 1) })
    const older = await RfqFactory.merge({ buyerOrganizationId: buyer.id }).create()
    await setDates('rfqs', older.id, { created_at: at(end, 14) })

    // Trois fournisseurs notifiés : un répond, un décline, un a seulement lu.
    for (const [supplier, status] of [
      [supplierA, 'responded'],
      [supplierB, 'declined'],
      [supplierC, 'viewed'],
    ] as const) {
      const recipient = await RfqSupplierFactory.merge({
        rfqId: published.id,
        supplierOrganizationId: supplier.id,
        status,
      }).create()
      await setDates('rfq_suppliers', recipient.id, { sent_at: at(end, 2) })
    }

    // Devis A accepté 48 h après sa remise, devis B refusé après 24 h, devis C antérieur.
    const accepted = await QuoteFactory.merge({
      rfqId: published.id,
      supplierOrganizationId: supplierA.id,
      status: 'accepted',
    }).create()
    await setDates('quotes', accepted.id, {
      submitted_at: at(end, 5),
      decided_at: at(end, 3),
    })
    const rejected = await QuoteFactory.merge({
      rfqId: published.id,
      supplierOrganizationId: supplierB.id,
      status: 'rejected',
    }).create()
    await setDates('quotes', rejected.id, {
      submitted_at: at(end, 5),
      decided_at: at(end, 4),
    })
    const previousQuote = await QuoteFactory.merge({
      rfqId: older.id,
      supplierOrganizationId: supplierC.id,
      status: 'accepted',
    }).create()
    await setDates('quotes', previousQuote.id, {
      submitted_at: at(end, 13),
      decided_at: at(end, 12),
    })

    // Commande du devis accepté : 1 000 € livrés 72 h après leur création. La
    // commande annulée de la période précédente ne compte pas dans le volume.
    const order = await Order.create({
      quoteId: accepted.id,
      buyerOrganizationId: buyer.id,
      supplierOrganizationId: supplierA.id,
      status: 'delivered',
      totalAmount: '1000',
      currency: 'EUR',
    })
    await setDates('orders', order.id, { created_at: at(end, 6), delivered_at: at(end, 3) })
    const cancelled = await Order.create({
      quoteId: previousQuote.id,
      buyerOrganizationId: buyer.id,
      supplierOrganizationId: supplierC.id,
      status: 'cancelled',
      totalAmount: '300',
      currency: 'EUR',
    })
    await setDates('orders', cancelled.id, { created_at: at(end, 12) })
  }

  test('calcule les indicateurs de la période et de la précédente', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await scenario()

    const response = await client.get(`/fr/admin?${query}`).withInertia().loginAs(admin)
    response.assertStatus(200)
    const { kpis, filters } = response.inertiaProps
    assert.equal(filters.from, end.minus({ days: 9 }).toISODate())
    assert.equal(kpis.period.previousTo, end.minus({ days: 10 }).toISODate())

    assert.deepEqual(kpis.accounts.newOrganizations, { current: 2, previous: 1 })
    assert.deepEqual(kpis.accounts.newUsers, { current: 1, previous: 0 })
    assert.deepEqual(kpis.accounts.activeUsers, { current: 2, previous: 0 })
    assert.deepEqual(kpis.accounts.organizationsByType, [
      { type: 'buyer', count: 1 },
      { type: 'supplier', count: 1 },
    ])

    assert.deepEqual(kpis.rfqs.created, { current: 2, previous: 1 })
    assert.deepEqual(kpis.rfqs.published, { current: 1, previous: 0 })
    assert.deepEqual(kpis.rfqs.publicationDelayHours, { current: 6, previous: null })
    assert.closeTo(kpis.rfqs.supplierResponseRate.current, 1 / 3, 0.001)
    assert.closeTo(kpis.rfqs.supplierDeclineRate.current, 1 / 3, 0.001)
    assert.isNull(kpis.rfqs.supplierResponseRate.previous)

    assert.deepEqual(kpis.quotes.submitted, { current: 2, previous: 1 })
    assert.deepEqual(kpis.quotes.accepted, { current: 1, previous: 1 })
    assert.deepEqual(kpis.quotes.rejected, { current: 1, previous: 0 })
    assert.deepEqual(kpis.quotes.decisionDelayHours, { current: 36, previous: 24 })

    assert.deepEqual(kpis.orders.created, { current: 1, previous: 1 })
    assert.deepEqual(kpis.orders.quoteToOrderRate, { current: 0.5, previous: 1 })
    assert.deepEqual(kpis.orders.deliveryDelayHours, { current: 72, previous: null })
    assert.deepEqual(kpis.orders.gmv, [{ currency: 'EUR', current: 1000, previous: 0 }])

    assert.equal(kpis.toHandle.agencyReviews, await agencyReviews())
    assert.lengthOf(kpis.daily, 10)
    const total = (key: 'organizations' | 'rfqs' | 'quotes' | 'orders') =>
      kpis.daily.reduce((sum: number, row: Record<string, number>) => sum + row[key], 0)
    assert.equal(total('organizations'), 2)
    assert.equal(total('rfqs'), 1)
    assert.equal(total('quotes'), 2)
    assert.equal(total('orders'), 1)
  })

  test('une période sans activité renvoie des valeurs nulles, sans division par zéro', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const empty = DateTime.now().minus({ years: 3 })
    const response = await client
      .get(`/fr/admin?from=${empty.minus({ days: 4 }).toISODate()}&to=${empty.toISODate()}`)
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    const { kpis } = response.inertiaProps
    assert.deepEqual(kpis.rfqs.created, { current: 0, previous: 0 })
    assert.deepEqual(kpis.orders.quoteToOrderRate, { current: null, previous: null })
    assert.deepEqual(kpis.rfqs.supplierResponseRate, { current: null, previous: null })
    assert.deepEqual(kpis.orders.gmv, [])
    assert.lengthOf(kpis.daily, 5)
  })

  test('décrit le catalogue : statuts et couverture de traduction', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const response = await client.get('/fr/admin').withInertia().loginAs(admin)

    const { catalogue } = response.inertiaProps.kpis
    const products = await Product.query().count('* as total').firstOrFail()
    assert.equal(catalogue.products, Number(products.$extras.total))
    assert.equal(
      catalogue.byLifecycle.reduce((sum: number, row: { count: number }) => sum + row.count, 0),
      catalogue.products
    )
    assert.lengthOf(catalogue.translationCoverage, 9)
    for (const row of catalogue.translationCoverage) {
      assert.isAtLeast(row.rate, 0)
      assert.isAtMost(row.rate, 1)
    }
  })

  test('la période par défaut couvre les 30 derniers jours', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const response = await client.get('/fr/admin').withInertia().loginAs(admin)

    const { filters, kpis } = response.inertiaProps
    assert.equal(filters.to, DateTime.now().toISODate())
    assert.equal(filters.from, DateTime.now().minus({ days: 29 }).toISODate())
    assert.lengthOf(kpis.daily, 30)
  })

  test('une durée excessive est plafonnée à un an en gardant la fin', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const response = await client
      .get(`/fr/admin?from=2001-01-01&to=${end.toISODate()}`)
      .withInertia()
      .loginAs(admin)

    const { filters, kpis } = response.inertiaProps
    assert.equal(filters.to, end.toISODate())
    assert.equal(filters.from, end.minus({ days: 365 }).toISODate())
    assert.lengthOf(kpis.daily, 366)
  })

  test('refuse une date invalide et une fin avant le début', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    for (const qs of ['from=2026-13-45', 'from=2026-10-10&to=2026-10-01']) {
      const response = await client.get(`/fr/admin?${qs}`).withInertia().redirects(0).loginAs(admin)
      assert.equal(response.status(), 302, qs)
    }
  })

  test('le support et le modérateur ne voient que les compteurs', async ({ client, assert }) => {
    const support = await UserFactory.apply('platformSupport').create()
    const moderator = await UserFactory.apply('platformModerator').create()

    for (const user of [support, moderator]) {
      const response = await client.get('/fr/admin').withInertia().loginAs(user)
      response.assertStatus(200)
      assert.isNull(response.inertiaProps.kpis)
      assert.isNull(response.inertiaProps.filters)
      assert.isDefined(response.inertiaProps.stats)
    }
  })

  test('un analyste voit les indicateurs', async ({ client, assert }) => {
    const analyst = await UserFactory.apply('platformAnalyst').create()
    const response = await client.get('/fr/admin').withInertia().loginAs(analyst)

    response.assertStatus(200)
    assert.isNotNull(response.inertiaProps.kpis)
  })
})

async function agencyReviews(): Promise<number> {
  const row = await db
    .from('organizations')
    .whereNull('archived_at')
    .whereRaw('cardinality(review_reasons) > 0')
    .count('* as total')
    .first()
  return Number(row?.total ?? 0)
}
