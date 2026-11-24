import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'
import { OrganizationFactory } from '#database/factories/organization_factory'
import ActivityAggregationService from '#services/activity_aggregation_service'
import SupplierInsightsService from '#services/supplier_insights_service'
import { trailingDateRange } from '#shared/helpers/activity_event'
import { SUPPLIER_INSIGHTS_PER_PAGE } from '#shared/types/supplier_insights'
import { createSupplierWithProducts, recordViews } from '#tests/utils/supplier_insights'
import { useDatabase } from '#tests/utils/setup'

const LAST_30_DAYS = () => trailingDateRange(30, DateTime.now())

test.group('ActivityAggregationService', (group) => {
  useDatabase(group)

  test('events ne garde que la période', async ({ assert }) => {
    const service = await app.container.make(ActivityAggregationService)
    await recordViews({ targetId: 1 })
    await recordViews({ targetId: 1, daysAgo: 40 })

    const rows = await service.events(LAST_30_DAYS()).select('ae.id')
    assert.lengthOf(rows, 1)
  })

  test('countByTarget classe les cibles et respecte la limite', async ({ assert }) => {
    const service = await app.container.make(ActivityAggregationService)
    await recordViews({ targetId: 7, times: 3 })
    await recordViews({ targetId: 8, times: 1 })
    await recordViews({ targetId: 9, times: 2 })
    await recordViews({ targetId: 9, type: 'supplier_viewed' })

    const rows = await service.countByTarget(service.events(LAST_30_DAYS()), 'product', 2)
    assert.deepEqual(rows, [
      { targetId: 7, count: 3 },
      { targetId: 9, count: 2 },
    ])
  })

  test('named nomme produits et fiches, `#id` sans traduction', async ({ assert }) => {
    const service = await app.container.make(ActivityAggregationService)
    const { products } = await createSupplierWithProducts(['Stylo'])

    assert.deepEqual(
      await service.named(
        [
          { targetId: products[0].id, count: 1 },
          { targetId: 999_999, count: 2 },
        ],
        'product',
        'en'
      ),
      [
        { targetId: products[0].id, count: 1, name: 'Stylo' },
        { targetId: 999_999, count: 2, name: '#999999' },
      ]
    )
    assert.deepEqual(await service.named([], 'supplier', 'fr'), [])
  })
})

test.group('SupplierInsightsService', (group) => {
  useDatabase(group)

  test('summary compte vues produit, fiche et ajouts à une demande', async ({ assert }) => {
    const service = await app.container.make(SupplierInsightsService)
    const { organization, supplier, products } = await createSupplierWithProducts(['A', 'B'])
    await recordViews({ targetId: products[0].id, times: 2 })
    await recordViews({ targetId: products[1].id })
    await recordViews({ targetId: products[1].id, type: 'rfq_product_added', times: 2 })
    await recordViews({ targetId: supplier.id, type: 'supplier_viewed' })
    await recordViews({ targetId: products[0].id, daysAgo: 45 })

    assert.deepEqual(await service.summary(organization.id, LAST_30_DAYS()), {
      productViews: 3,
      supplierViews: 1,
      rfqAdditions: 2,
      viewedProducts: 2,
    })
  })

  test('summary vaut zéro sans produit ni événement', async ({ assert }) => {
    const service = await app.container.make(SupplierInsightsService)
    const { organization } = await createSupplierWithProducts([])

    assert.deepEqual(await service.summary(organization.id, LAST_30_DAYS()), {
      productViews: 0,
      supplierViews: 0,
      rfqAdditions: 0,
      viewedProducts: 0,
    })
  })

  test('products pagine tous les produits, les plus consultés en tête', async ({ assert }) => {
    const service = await app.container.make(SupplierInsightsService)
    const names = Array.from({ length: SUPPLIER_INSIGHTS_PER_PAGE + 2 }, (_, i) => `P${i}`)
    const { organization, products } = await createSupplierWithProducts(names)
    const top = products[SUPPLIER_INSIGHTS_PER_PAGE + 1]
    await recordViews({ targetId: top.id, times: 4 })

    const first = await service.products(organization.id, LAST_30_DAYS(), {
      page: 1,
      locale: 'fr',
    })
    assert.equal(first.data[0].productId, top.id)
    assert.equal(first.data[0].views, 4)
    assert.lengthOf(first.data, SUPPLIER_INSIGHTS_PER_PAGE)
    assert.deepEqual(first.meta, {
      total: SUPPLIER_INSIGHTS_PER_PAGE + 2,
      perPage: SUPPLIER_INSIGHTS_PER_PAGE,
      currentPage: 1,
      lastPage: 2,
    })

    const second = await service.products(organization.id, LAST_30_DAYS(), {
      page: 2,
      locale: 'fr',
    })
    assert.lengthOf(second.data, 2)
    assert.isTrue(second.data.every((row) => row.views === 0))
  })

  test('agencies liste les agences, sans événement anonyme ni de plus de 90 jours', async ({
    assert,
  }) => {
    const service = await app.container.make(SupplierInsightsService)
    const { organization, supplier, products } = await createSupplierWithProducts(['A'])
    const agency = await OrganizationFactory.merge({ name: 'Agence Une' }).create()
    const both = await OrganizationFactory.apply('both').merge({ name: 'Agence Mixte' }).create()
    const old = await OrganizationFactory.merge({ name: 'Agence Vieille' }).create()
    await recordViews({ targetId: products[0].id, organizationId: agency.id, daysAgo: 2 })
    await recordViews({ targetId: supplier.id, type: 'supplier_viewed', organizationId: both.id })
    await recordViews({ targetId: products[0].id, organizationId: old.id, daysAgo: 100 })
    await recordViews({ targetId: products[0].id, organizationId: null })
    await recordViews({
      targetId: products[0].id,
      type: 'rfq_product_added',
      organizationId: agency.id,
    })

    const range = trailingDateRange(365, DateTime.now())
    const rows = await service.agencies(organization.id, range)

    assert.deepEqual(
      rows.map((row) => [row.name, row.views, row.products]),
      [
        ['Agence Mixte', 1, 0],
        ['Agence Une', 1, 1],
      ]
    )
  })

  test('agencies écarte les agences archivées ou en cours de validation', async ({ assert }) => {
    const service = await app.container.make(SupplierInsightsService)
    const { organization, products } = await createSupplierWithProducts(['A'])
    const validated = await OrganizationFactory.merge({ name: 'Agence Validée' }).create()
    const archived = await OrganizationFactory.apply('archived')
      .merge({ name: 'Agence Fermée' })
      .create()
    const pending = await OrganizationFactory.merge({
      name: 'Agence En Revue',
      reviewReasons: ['vat_unverified'],
    }).create()
    await Promise.all(
      [validated, archived, pending].map((agency) =>
        recordViews({ targetId: products[0].id, organizationId: agency.id })
      )
    )

    const rows = await service.agencies(organization.id, LAST_30_DAYS())

    assert.deepEqual(
      rows.map((row) => row.name),
      ['Agence Validée']
    )
  })

  test('products ramène une page au-delà de la dernière à la dernière', async ({ assert }) => {
    const service = await app.container.make(SupplierInsightsService)
    const { organization } = await createSupplierWithProducts(['A', 'B'])

    const page = await service.products(organization.id, LAST_30_DAYS(), {
      page: 9,
      locale: 'fr',
    })

    assert.lengthOf(page.data, 2)
    assert.equal(page.meta.currentPage, 1)
  })

  test('report ne lit pas les agences quand elles ne sont pas révélées', async ({ assert }) => {
    const service = await app.container.make(SupplierInsightsService)
    const { organization, products } = await createSupplierWithProducts(['A'])
    const agency = await OrganizationFactory.create()
    await recordViews({ targetId: products[0].id, organizationId: agency.id })

    const hidden = await service.report(organization.id, {
      period: 30,
      page: 1,
      locale: 'fr',
      revealAgencies: false,
    })
    assert.isNull(hidden.agencies)
    assert.equal(hidden.summary.productViews, 1)
    assert.deepEqual(hidden.range, LAST_30_DAYS())

    const shown = await service.report(organization.id, {
      period: 30,
      page: 1,
      locale: 'fr',
      revealAgencies: true,
    })
    assert.lengthOf(shown.agencies ?? [], 1)
  })
})
