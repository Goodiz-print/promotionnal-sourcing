import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { ActivityEventFactory } from '#database/factories/activity_event_factory'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import Product from '#models/product'
import SearchEvent from '#models/search_event'
import { useDatabase } from '#tests/utils/setup'
import type { SearchEventMode, SearchEventSource } from '#shared/types/search_event'

interface SearchOptions {
  query?: string | null
  results?: number
  mode?: SearchEventMode
  source?: SearchEventSource
  locale?: string
  filters?: Record<string, unknown>
  categoryId?: number | null
  organizationId?: number | null
  createdAt?: DateTime
}

function search(options: SearchOptions = {}) {
  const results = options.results ?? 3
  return SearchEvent.create({
    source: options.source ?? 'catalogue',
    query: options.query === undefined ? 'crayon' : options.query,
    filters: options.filters ?? {},
    categoryId: options.categoryId ?? null,
    mode: options.mode ?? 'keyword',
    resultsCount: results,
    zeroResults: results === 0,
    organizationId: options.organizationId ?? null,
    locale: options.locale ?? 'fr',
    createdAt: options.createdAt ?? DateTime.now(),
  })
}

test.group('Ce que cherchent les clients — droits', (group) => {
  useDatabase(group)

  test('un admin et un analyste y accèdent', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const analyst = await UserFactory.apply('platformAnalyst').create()

    const asAdmin = await client.get('/fr/admin/demand').withInertia().loginAs(admin)
    asAdmin.assertStatus(200)
    asAdmin.assertInertiaComponent('admin/demand/index')

    const asAnalyst = await client.get('/fr/admin/demand').withInertia().loginAs(analyst)
    asAnalyst.assertStatus(200)
  })

  test('le support et le modérateur n’y accèdent pas, ni l’export', async ({ client }) => {
    const support = await UserFactory.apply('platformSupport').create()
    const moderator = await UserFactory.apply('platformModerator').create()

    for (const user of [support, moderator]) {
      const page = await client.get('/fr/admin/demand').withInertia().loginAs(user)
      page.assertStatus(403)
      const csv = await client.get('/fr/admin/demand/export').loginAs(user)
      csv.assertStatus(403)
    }
  })

  test('un utilisateur sans rôle plateforme n’y accède pas', async ({ client }) => {
    const user = await UserFactory.create()
    const response = await client.get('/fr/admin/demand').withInertia().loginAs(user)
    response.assertStatus(403)
  })
})

test.group('Ce que cherchent les clients — agrégations', (group) => {
  useDatabase(group, { seed: 'full' })

  test('classe les requêtes et isole celles sans résultat', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await search({ query: 'crayon', results: 4 })
    await search({ query: 'crayon', results: 2 })
    await search({ query: 'gourde', results: 0 })
    await search({ query: 'gourde', results: 0 })
    await search({ query: 'gourde', results: 1 })
    await search({ query: null, results: 9 })

    const response = await client.get('/fr/admin/demand').withInertia().loginAs(admin)
    const { report } = response.inertiaProps

    assert.deepInclude(report.summary, { searches: 6, zeroResultSearches: 2 })
    assert.closeTo(report.summary.zeroResultRate, 2 / 6, 0.0001)
    assert.deepEqual(
      report.topQueries.map((row: { query: string }) => row.query),
      ['gourde', 'crayon']
    )
    assert.deepEqual(report.topQueries[1], {
      query: 'crayon',
      searches: 2,
      averageResults: 3,
      zeroResultSearches: 0,
    })
    assert.deepEqual(
      report.zeroResultQueries.map((row: { query: string }) => row.query),
      ['gourde']
    )
    assert.equal(report.zeroResultQueries[0].zeroResultSearches, 2)
  })

  test('respecte la période, l’écran et la langue', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await search({ query: 'récent' })
    await search({ query: 'ancien', createdAt: DateTime.now().minus({ days: 60 }) })
    await search({ query: 'annuaire', source: 'suppliers' })
    await search({ query: 'english', locale: 'en' })

    const byDefault = await client.get('/fr/admin/demand').withInertia().loginAs(admin)
    assert.notInclude(
      byDefault.inertiaProps.report.topQueries.map((row: { query: string }) => row.query),
      'ancien'
    )

    const wide = await client
      .get('/fr/admin/demand')
      .qs({ from: DateTime.now().minus({ days: 90 }).toISODate() })
      .withInertia()
      .loginAs(admin)
    assert.include(
      wide.inertiaProps.report.topQueries.map((row: { query: string }) => row.query),
      'ancien'
    )

    const suppliers = await client
      .get('/fr/admin/demand')
      .qs({ source: 'suppliers' })
      .withInertia()
      .loginAs(admin)
    assert.deepEqual(
      suppliers.inertiaProps.report.topQueries.map((row: { query: string }) => row.query),
      ['annuaire']
    )

    const english = await client
      .get('/fr/admin/demand')
      .qs({ locale: 'en' })
      .withInertia()
      .loginAs(admin)
    assert.equal(english.inertiaProps.report.summary.searches, 1)
  })

  test('filtre par type d’organisation', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const supplier = await OrganizationFactory.apply('supplier').create()
    const buyer = await OrganizationFactory.create()
    await search({ query: 'acheteur', organizationId: buyer.id })
    await search({ query: 'fournisseur', organizationId: supplier.id })
    await search({ query: 'anonyme' })

    const response = await client
      .get('/fr/admin/demand')
      .qs({ organizationType: 'supplier' })
      .withInertia()
      .loginAs(admin)

    assert.deepEqual(
      response.inertiaProps.report.topQueries.map((row: { query: string }) => row.query),
      ['fournisseur']
    )
  })

  test('compte les modes, les filtres posés et la tendance par jour', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await search({ mode: 'semantic', filters: { madeInEurope: true, isEco: true } })
    await search({ mode: 'semantic', filters: { madeInEurope: true } })
    await search({ mode: 'keyword', createdAt: DateTime.now().minus({ days: 1 }) })

    const response = await client.get('/fr/admin/demand').withInertia().loginAs(admin)
    const { report } = response.inertiaProps

    assert.deepEqual(report.modes, [
      { mode: 'semantic', searches: 2 },
      { mode: 'keyword', searches: 1 },
    ])
    assert.closeTo(report.summary.semanticRate, 2 / 3, 0.0001)
    assert.deepEqual(report.filters[0], { filter: 'madeInEurope', searches: 2 })
    assert.lengthOf(report.trend, 2)
    assert.deepEqual(
      report.trend.map((row: { searches: number }) => row.searches),
      [1, 2]
    )
  })

  test('classe les produits et fournisseurs consultés et les produits demandés en devis', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const [first, second] = await Product.query().orderBy('id').limit(2)
    const supplier = await OrganizationFactory.apply('supplier').create()
    const view = (id: number) => ActivityEventFactory.merge({ targetId: id })
    await view(first.id).createMany(3)
    await view(second.id).create()
    await ActivityEventFactory.merge({
      type: 'supplier_viewed',
      targetType: 'supplier',
      targetId: supplier.id,
    }).create()
    await ActivityEventFactory.merge({
      type: 'rfq_product_added',
      targetId: second.id,
    }).createMany(2)

    const response = await client.get('/fr/admin/demand').withInertia().loginAs(admin)
    const { report } = response.inertiaProps

    assert.deepEqual(
      report.viewedProducts.map((row: { targetId: number; count: number }) => [
        row.targetId,
        row.count,
      ]),
      [
        [first.id, 3],
        [second.id, 1],
      ]
    )
    assert.isNotEmpty(report.viewedProducts[0].name)
    assert.deepEqual(
      report.viewedSuppliers.map((row: { name: string; count: number }) => [row.name, row.count]),
      [[supplier.name, 1]]
    )
    assert.deepEqual(
      report.rfqProducts.map((row: { targetId: number; count: number }) => [
        row.targetId,
        row.count,
      ]),
      [[second.id, 2]]
    )
  })

  test('refuse une période invalide au lieu de l’ignorer', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await client.get('/fr/admin/demand?from=hier').redirects(0).loginAs(admin)

    response.assertStatus(302)
  })
})

test.group('Ce que cherchent les clients — export CSV', (group) => {
  useDatabase(group)

  test('exporte les requêtes de la période', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await search({ query: 'crayon', results: 4 })
    await search({ query: 'crayon', results: 0 })

    const response = await client.get('/fr/admin/demand/export').loginAs(admin)

    response.assertStatus(200)
    assert.include(response.header('content-type'), 'text/csv')
    assert.include(response.header('content-disposition'), 'attachment')
    const lines = response.text().replace('﻿', '').trim().split('\r\n')
    assert.lengthOf(lines, 2)
    assert.equal(lines[1], '"crayon";"2";"2";"1"')
  })

  test('neutralise les termes qui ressemblent à une formule', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await search({ query: '=1+1' })

    const response = await client.get('/fr/admin/demand/export').loginAs(admin)

    assert.include(response.text(), `"'=1+1"`)
  })
})
