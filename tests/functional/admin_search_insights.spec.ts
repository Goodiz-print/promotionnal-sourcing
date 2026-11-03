import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { UserFactory } from '#database/factories/user_factory'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { SearchEventFactory } from '#database/factories/search_event_factory'
import { ActivityEventFactory } from '#database/factories/activity_event_factory'
import { useDatabase } from '#tests/utils/setup'
import db from '@adonisjs/lucid/services/db'

test.group('Admin Search Insights - Access', (group) => {
  useDatabase(group)

  test('admin can access the screen', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await client.get('/fr/admin/search').withInertia().loginAs(admin)

    response.assertStatus(200)
    response.assertInertiaComponent('admin/search/index')
  })

  test('analyst can access the screen (monitoring.view)', async ({ client }) => {
    const analyst = await UserFactory.apply('platformAnalyst').create()

    const response = await client.get('/fr/admin/search').withInertia().loginAs(analyst)

    response.assertStatus(200)
    response.assertInertiaComponent('admin/search/index')
  })

  test('support receives 403 (no monitoring.view)', async ({ client }) => {
    const support = await UserFactory.apply('platformSupport').create()

    const response = await client.get('/fr/admin/search').withInertia().loginAs(support)

    response.assertStatus(403)
  })

  test('moderator receives 403', async ({ client }) => {
    const moderator = await UserFactory.apply('platformModerator').create()

    const response = await client.get('/fr/admin/search').withInertia().loginAs(moderator)

    response.assertStatus(403)
  })

  test('user without platform role receives 403', async ({ client }) => {
    const user = await UserFactory.create()

    const response = await client.get('/fr/admin/search').withInertia().loginAs(user)

    response.assertStatus(403)
  })

  test('anonymous visitor is redirected to login', async ({ client }) => {
    const response = await client.get('/fr/admin/search').redirects(0)

    // AdonisJS auth redirects to login
    response.assertStatus(302)
    response.assertHeader('location', '/login')
  })
})

test.group('Admin Search Insights - Data', (group) => {
  useDatabase(group)

  test('top queries and counts are correct', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    // Create search events
    const today = DateTime.now().setZone('Europe/Paris').startOf('day')
    await SearchEventFactory.merge({ query: 'stylo', createdAt: today }).createMany(5)
    await SearchEventFactory.merge({ query: 'carnet', createdAt: today }).createMany(3)
    await SearchEventFactory.merge({ query: 'stylo', createdAt: today })
      .apply('zeroResults')
      .create()

    const response = await client.get('/fr/admin/search').withInertia().loginAs(admin)

    response.assertStatus(200)
    const report = response.inertiaProps.report
    assert.isNotNull(report)
    assert.equal(report.summary.total, 9)
    assert.equal(report.summary.zeroResults, 1)

    // Top queries should have stylo first with 6 searches
    const styloQuery = report.topQueries.find((q: { query: string }) => q.query === 'stylo')
    assert.isNotNull(styloQuery)
    assert.equal(styloQuery.count, 6)
    assert.equal(styloQuery.zeroCount, 1)

    const carnetQuery = report.topQueries.find((q: { query: string }) => q.query === 'carnet')
    assert.isNotNull(carnetQuery)
    assert.equal(carnetQuery.count, 3)
  })

  test('zero result queries', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const today = DateTime.now().setZone('Europe/Paris').startOf('day')
    await SearchEventFactory.merge({ query: 'introuvable', createdAt: today })
      .apply('zeroResults')
      .createMany(4)
    await SearchEventFactory.merge({ query: 'existant', createdAt: today }).createMany(2)

    const response = await client.get('/fr/admin/search').withInertia().loginAs(admin)

    const report = response.inertiaProps.report
    assert.equal(report.zeroResultQueries.length, 1)
    assert.equal(report.zeroResultQueries[0].query, 'introuvable')
    assert.equal(report.zeroResultQueries[0].count, 4)
  })

  test('current and previous period', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const today = DateTime.now().setZone('Europe/Paris').startOf('day')
    const yesterday = today.minus({ days: 1 })
    const twoDaysAgo = today.minus({ days: 2 })

    // Current period: yesterday to today
    await SearchEventFactory.merge({ createdAt: today }).createMany(3)
    await SearchEventFactory.merge({ createdAt: yesterday }).createMany(2)

    // Previous period: 2 days before
    await SearchEventFactory.merge({ createdAt: twoDaysAgo }).createMany(7)

    const from = yesterday.toFormat('yyyy-MM-dd')
    const to = today.toFormat('yyyy-MM-dd')

    const response = await client
      .get(`/fr/admin/search?from=${from}&to=${to}`)
      .withInertia()
      .loginAs(admin)

    const report = response.inertiaProps.report
    assert.equal(report.summary.total, 5)
    assert.equal(report.summary.previousTotal, 7)
  })

  test('filter by source', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const today = DateTime.now().setZone('Europe/Paris').startOf('day')
    await SearchEventFactory.merge({ source: 'catalogue', createdAt: today }).createMany(5)
    await SearchEventFactory.merge({ source: 'suppliers', createdAt: today }).createMany(3)

    const response = await client
      .get('/fr/admin/search?source=catalogue')
      .withInertia()
      .loginAs(admin)

    const report = response.inertiaProps.report
    assert.equal(report.summary.total, 5)
    assert.equal(report.filters.source, 'catalogue')
  })

  test('filter by locale', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const today = DateTime.now().setZone('Europe/Paris').startOf('day')
    await SearchEventFactory.merge({ locale: 'fr', createdAt: today }).createMany(4)
    await SearchEventFactory.merge({ locale: 'en', createdAt: today }).createMany(2)

    const response = await client.get('/fr/admin/search?locale=en').withInertia().loginAs(admin)

    const report = response.inertiaProps.report
    assert.equal(report.summary.total, 2)
    assert.equal(report.filters.locale, 'en')
  })

  test('filter by organization type', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const buyerOrg = await OrganizationFactory.merge({ organizationType: 'buyer' }).create()
    const supplierOrg = await OrganizationFactory.merge({ organizationType: 'supplier' }).create()

    const today = DateTime.now().setZone('Europe/Paris').startOf('day')
    await SearchEventFactory.merge({
      organizationId: buyerOrg.id,
      createdAt: today,
    }).createMany(4)
    await SearchEventFactory.merge({
      organizationId: supplierOrg.id,
      createdAt: today,
    }).createMany(2)

    const response = await client
      .get('/fr/admin/search?organizationType=buyer')
      .withInertia()
      .loginAs(admin)

    const report = response.inertiaProps.report
    assert.equal(report.summary.total, 4)
    assert.equal(report.filters.organizationType, 'buyer')
  })

  test('complete daily series with zero days', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const today = DateTime.now().setZone('Europe/Paris').startOf('day')
    const threeDaysAgo = today.minus({ days: 3 })

    // Events only on day 1 and day 3, not day 2
    await SearchEventFactory.merge({ createdAt: threeDaysAgo }).createMany(2)
    await SearchEventFactory.merge({ createdAt: today }).createMany(1)

    const from = threeDaysAgo.toFormat('yyyy-MM-dd')
    const to = today.toFormat('yyyy-MM-dd')

    const response = await client
      .get(`/fr/admin/search?from=${from}&to=${to}`)
      .withInertia()
      .loginAs(admin)

    const report = response.inertiaProps.report
    // Should have 4 days in the series
    assert.equal(report.daily.length, 4)

    // Check that all days are present (including day 2 with 0)
    const dates = report.daily.map((d: { date: string }) => d.date)
    assert.include(dates, from)
    assert.include(dates, to)

    // Day with 0 searches should be present
    const dayTwo = today.minus({ days: 2 }).toFormat('yyyy-MM-dd')
    const dayTwoData = report.daily.find((d: { date: string }) => d.date === dayTwo)
    assert.isNotNull(dayTwoData)
    assert.equal(dayTwoData.total, 0)
  })
})

test.group('Admin Search Insights - Validation', (group) => {
  useDatabase(group)

  test('from > to generates validation error', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await client
      .get('/fr/admin/search?from=2024-12-15&to=2024-12-10')
      .header('Accept', 'application/json')
      .loginAs(admin)

    response.assertStatus(422)
  })

  test('period too long generates validation error', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    // More than 366 days
    const response = await client
      .get('/fr/admin/search?from=2023-01-01&to=2024-12-31')
      .header('Accept', 'application/json')
      .loginAs(admin)

    response.assertStatus(422)
  })

  test('invalid date format is rejected', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await client
      .get('/fr/admin/search?from=invalid-date')
      .header('Accept', 'application/json')
      .loginAs(admin)

    // VineJS validation error returns 422
    response.assertStatus(422)
  })

  test('invalid source is rejected', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await client
      .get('/fr/admin/search?source=invalid_source')
      .header('Accept', 'application/json')
      .loginAs(admin)

    response.assertStatus(422)
  })
})

test.group('Admin Search Insights - CSV Export', (group) => {
  useDatabase(group)

  test('CSV export contains UTF-8 BOM', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const today = DateTime.now().setZone('Europe/Paris').startOf('day')
    await SearchEventFactory.merge({ createdAt: today }).create()

    const response = await client.get('/fr/admin/search/export').loginAs(admin)

    response.assertStatus(200)
    response.assertHeader('content-type', 'text/csv; charset=utf-8')

    const body = response.text()
    // BOM is \uFEFF at the start
    assert.isTrue(body.startsWith('\uFEFF'))
  })

  test('CSV export contains headers', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const today = DateTime.now().setZone('Europe/Paris').startOf('day')
    await SearchEventFactory.merge({ createdAt: today }).create()

    const response = await client.get('/fr/admin/search/export').loginAs(admin)

    const body = response.text()
    assert.include(body, 'Section,Metric,Value')
    assert.include(body, 'Top Queries')
    assert.include(body, 'Query,Count,Zero Count,Avg Results')
    assert.include(body, 'Daily')
    assert.include(body, 'Date,Total,Zero Results')
  })

  test('CSV export escapes dangerous cells', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const today = DateTime.now().setZone('Europe/Paris').startOf('day')
    // Create a search with a dangerous query
    await SearchEventFactory.merge({
      query: '=cmd|calc',
      createdAt: today,
    }).create()

    const response = await client.get('/fr/admin/search/export').loginAs(admin)

    const body = response.text()
    // Should be prefixed with apostrophe for formula protection
    assert.include(body, "'=cmd|calc")
  })

  test('CSV export escapes double quotes', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const today = DateTime.now().setZone('Europe/Paris').startOf('day')
    await SearchEventFactory.merge({
      query: 'test "quoted" value',
      createdAt: today,
    }).create()

    const response = await client.get('/fr/admin/search/export').loginAs(admin)

    const body = response.text()
    // Double quotes should be escaped
    assert.include(body, '"test ""quoted"" value"')
  })

  test('analyst can export CSV', async ({ client }) => {
    const analyst = await UserFactory.apply('platformAnalyst').create()

    const today = DateTime.now().setZone('Europe/Paris').startOf('day')
    await SearchEventFactory.merge({ createdAt: today }).create()

    const response = await client.get('/fr/admin/search/export').loginAs(analyst)

    response.assertStatus(200)
    response.assertHeader('content-type', 'text/csv; charset=utf-8')
  })

  test('support cannot export CSV', async ({ client }) => {
    const support = await UserFactory.apply('platformSupport').create()

    const response = await client.get('/fr/admin/search/export').loginAs(support)

    response.assertStatus(403)
  })
})

/** Fournisseur et catégorie (id 1) requis par les clés étrangères de `products`. */
async function insertSupplierAndCategory() {
  await db.table('suppliers').insert({
    id: 1,
    slug: 'fk-supplier',
    country: 'FR',
    is_active: true,
    created_at: DateTime.now().toJSDate(),
  })
  await db.table('categories').insert({
    id: 1,
    slug: 'fk-category',
    created_at: DateTime.now().toJSDate(),
  })
}

test.group('Admin Search Insights - Top Products/Suppliers', (group) => {
  useDatabase(group)

  test('top products with views and RFQ adds', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    await insertSupplierAndCategory()
    const productId = 1
    await db.table('products').insert({
      id: productId,
      supplier_id: 1,
      category_id: 1,
      slug: 'test-product',
      reference: 'TEST-001',
      source_locale: 'fr',
      currency: 'EUR',
      is_active: true,
      is_eco: false,
      printable: false,
      made_in_europe: false,
      is_configurable: false,
      lifecycle_status: 'active',
      created_at: DateTime.now().toJSDate(),
    })
    await db.table('product_translations').insert({
      product_id: productId,
      locale: 'fr',
      name: 'Produit Test',
      is_auto: false,
      created_at: DateTime.now().toJSDate(),
    })

    const today = DateTime.now().setZone('Europe/Paris').startOf('day')
    await ActivityEventFactory.merge({
      type: 'product_viewed',
      targetType: 'product',
      targetId: productId,
      createdAt: today,
    }).createMany(5)
    await ActivityEventFactory.merge({
      type: 'rfq_product_added',
      targetType: 'product',
      targetId: productId,
      createdAt: today,
    }).createMany(2)

    const response = await client.get('/fr/admin/search').withInertia().loginAs(admin)

    const report = response.inertiaProps.report
    assert.isNotNull(report.topProducts)
    assert.isAbove(report.topProducts.length, 0)

    const product = report.topProducts.find((p: { targetId: number }) => p.targetId === productId)
    assert.isNotNull(product)
    assert.equal(product.views, 5)
    assert.equal(product.rfqAdds, 2)
    assert.equal(product.name, 'Produit Test')
  })

  test('product names with translation fallback', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    await insertSupplierAndCategory()
    const productId = 2
    await db.table('products').insert({
      id: productId,
      supplier_id: 1,
      category_id: 1,
      slug: 'english-product',
      reference: 'EN-001',
      source_locale: 'en',
      currency: 'EUR',
      is_active: true,
      is_eco: false,
      printable: false,
      made_in_europe: false,
      is_configurable: false,
      lifecycle_status: 'active',
      created_at: DateTime.now().toJSDate(),
    })
    await db.table('product_translations').insert({
      product_id: productId,
      locale: 'en',
      name: 'English Product',
      is_auto: false,
      created_at: DateTime.now().toJSDate(),
    })

    const today = DateTime.now().setZone('Europe/Paris').startOf('day')
    await ActivityEventFactory.merge({
      type: 'product_viewed',
      targetType: 'product',
      targetId: productId,
      createdAt: today,
    }).createMany(3)

    // Request in French locale should fallback to English
    const response = await client.get('/fr/admin/search').withInertia().loginAs(admin)

    const report = response.inertiaProps.report
    const product = report.topProducts.find((p: { targetId: number }) => p.targetId === productId)
    assert.isNotNull(product)
    assert.equal(product.name, 'English Product')
  })

  test('top suppliers with views', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    // Create supplier translations
    const supplierId = 1
    await db.table('suppliers').insert({
      id: supplierId,
      slug: 'test-supplier',
      country: 'FR',
      is_active: true,
      created_at: DateTime.now().toJSDate(),
    })
    await db.table('supplier_translations').insert({
      supplier_id: supplierId,
      locale: 'fr',
      name: 'Fournisseur Test',
      created_at: DateTime.now().toJSDate(),
    })

    const today = DateTime.now().setZone('Europe/Paris').startOf('day')
    await ActivityEventFactory.merge({
      type: 'supplier_viewed',
      targetType: 'supplier',
      targetId: supplierId,
      createdAt: today,
    }).createMany(4)

    const response = await client.get('/fr/admin/search').withInertia().loginAs(admin)

    const report = response.inertiaProps.report
    assert.isNotNull(report.topSuppliers)
    assert.isAbove(report.topSuppliers.length, 0)

    const supplier = report.topSuppliers.find(
      (s: { targetId: number }) => s.targetId === supplierId
    )
    assert.isNotNull(supplier)
    assert.equal(supplier.views, 4)
    assert.equal(supplier.rfqAdds, 0) // Suppliers don't have RFQ adds
    assert.equal(supplier.name, 'Fournisseur Test')
  })
})

test.group('Admin Search Insights - Inertia Props', (group) => {
  useDatabase(group)

  test('Inertia props contain report and filters', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await client.get('/fr/admin/search').withInertia().loginAs(admin)

    assert.property(response.inertiaProps, 'report')

    const { filters } = response.inertiaProps.report
    assert.property(filters, 'from')
    assert.property(filters, 'to')
    assert.property(filters, 'source')
    assert.property(filters, 'locale')
    assert.property(filters, 'organizationType')
  })

  test('report contains all sections', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const today = DateTime.now().setZone('Europe/Paris').startOf('day')
    await SearchEventFactory.merge({ createdAt: today }).create()

    const response = await client.get('/fr/admin/search').withInertia().loginAs(admin)

    const { report } = response.inertiaProps
    assert.isNotNull(report)
    assert.property(report, 'filters')
    assert.property(report, 'summary')
    assert.property(report, 'topQueries')
    assert.property(report, 'zeroResultQueries')
    assert.property(report, 'daily')
    assert.property(report, 'topCategories')
    assert.property(report, 'topFilters')
    assert.property(report, 'topProducts')
    assert.property(report, 'topSuppliers')

    // Summary structure
    assert.property(report.summary, 'total')
    assert.property(report.summary, 'zeroResults')
    assert.property(report.summary, 'zeroRate')
    assert.property(report.summary, 'byMode')
    assert.property(report.summary, 'previousTotal')
  })
})
