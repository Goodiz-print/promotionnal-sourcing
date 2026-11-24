import { test } from '@japa/runner'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { createMember, subscribeOrganization } from '#tests/utils/organizations'
import { createSupplierWithProducts, recordViews } from '#tests/utils/supplier_insights'
import { useDatabase } from '#tests/utils/setup'

const URL = '/fr/supplier/insights'

test.group('Consultations fournisseur — droits', (group) => {
  useDatabase(group)

  test('le propriétaire et un manager accèdent à la page', async ({ client }) => {
    const { organization, owner } = await createSupplierWithProducts([])
    const manager = await createMember(organization, 'manager')

    const responses = await Promise.all(
      [owner, manager].map((user) => client.get(URL).withInertia().loginAs(user))
    )
    responses.forEach((response) => {
      response.assertStatus(200)
      response.assertInertiaComponent('supplier/insights/index')
    })
  })

  test('un simple membre n’y accède pas', async ({ client }) => {
    const { organization } = await createSupplierWithProducts([])
    const member = await createMember(organization, 'member')

    const response = await client.get(URL).withInertia().loginAs(member)
    response.assertStatus(403)
  })

  test('une agence n’y accède pas', async ({ client }) => {
    const agency = await OrganizationFactory.create()
    const owner = await createMember(agency, 'owner')

    const response = await client.get(URL).withInertia().loginAs(owner)
    response.assertStatus(403)
  })

  test('un visiteur est renvoyé vers la connexion', async ({ client }) => {
    const response = await client.get(URL).redirects(0)
    response.assertStatus(302)
  })
})

test.group('Consultations fournisseur — données', (group) => {
  useDatabase(group)

  test('compte les consultations de chacun de ses produits, même à zéro', async ({
    client,
    assert,
  }) => {
    const { owner, supplier, products } = await createSupplierWithProducts(['Stylo', 'Gourde'])
    const [pen, flask] = products
    await recordViews({ targetId: flask.id, times: 3 })
    await recordViews({ targetId: flask.id, type: 'rfq_product_added' })
    await recordViews({ targetId: supplier.id, type: 'supplier_viewed', times: 2 })

    const response = await client.get(URL).withInertia().loginAs(owner)
    const { report, period } = response.inertiaProps

    assert.equal(period, 30)
    assert.deepEqual(report.summary, {
      productViews: 3,
      supplierViews: 2,
      rfqAdditions: 1,
      viewedProducts: 1,
    })
    assert.deepEqual(report.products.data, [
      { productId: flask.id, name: 'Gourde', views: 3, rfqAdditions: 1 },
      { productId: pen.id, name: 'Stylo', views: 0, rfqAdditions: 0 },
    ])
    assert.equal(report.products.meta.total, 2)
  })

  test('ne voit jamais les consultations des produits d’un autre fournisseur', async ({
    client,
    assert,
  }) => {
    const mine = await createSupplierWithProducts(['Mien'])
    const other = await createSupplierWithProducts(['Autre'])
    await recordViews({ targetId: other.products[0].id, times: 5 })
    await recordViews({ targetId: other.supplier.id, type: 'supplier_viewed' })

    const response = await client.get(URL).withInertia().loginAs(mine.owner)
    const { report } = response.inertiaProps

    assert.equal(report.summary.productViews, 0)
    assert.equal(report.summary.supplierViews, 0)
    assert.deepEqual(
      report.products.data.map((row: { name: string }) => row.name),
      ['Mien']
    )
  })

  test('suit la période choisie et ignore une période invalide', async ({ client, assert }) => {
    const { owner, products } = await createSupplierWithProducts(['Stylo'])
    await recordViews({ targetId: products[0].id })
    await recordViews({ targetId: products[0].id, daysAgo: 60 })

    const byDefault = await client.get(URL).withInertia().loginAs(owner)
    assert.equal(byDefault.inertiaProps.report.summary.productViews, 1)

    const quarter = await client.get(`${URL}?period=90`).withInertia().loginAs(owner)
    assert.equal(quarter.inertiaProps.period, 90)
    assert.equal(quarter.inertiaProps.report.summary.productViews, 2)

    const invalid = await client.get(`${URL}?period=12&page=abc`).withInertia().loginAs(owner)
    invalid.assertStatus(200)
    assert.equal(invalid.inertiaProps.period, 30)
  })
})

test.group('Consultations fournisseur — identité des agences', (group) => {
  useDatabase(group)

  test('un non abonné ne reçoit aucune agence dans les props, mais l’encart', async ({
    client,
    assert,
  }) => {
    const { owner, supplier, products } = await createSupplierWithProducts(['Stylo'])
    const agency = await OrganizationFactory.merge({ name: 'Agence Secrète Zorglub' }).create()
    await recordViews({ targetId: products[0].id, organizationId: agency.id, times: 2 })
    await recordViews({
      targetId: supplier.id,
      type: 'supplier_viewed',
      organizationId: agency.id,
    })

    const response = await client.get(URL).withInertia().loginAs(owner)
    const props = response.inertiaProps
    const serialized = JSON.stringify(props)

    assert.isNull(props.report.agencies)
    assert.deepEqual(props.upsell, { canSubscribe: true })
    assert.equal(props.report.summary.productViews, 2)
    assert.notInclude(serialized, 'Agence Secrète Zorglub')
    assert.notInclude(serialized, agency.slug)
    assert.notMatch(serialized, new RegExp(`"organizationId":${agency.id}\\b`))
  })

  test('un manager non abonné voit l’encart sans bouton de souscription', async ({
    client,
    assert,
  }) => {
    const { organization } = await createSupplierWithProducts([])
    const manager = await createMember(organization, 'manager')

    const response = await client.get(URL).withInertia().loginAs(manager)
    assert.deepEqual(response.inertiaProps.upsell, { canSubscribe: false })
  })

  test('un abonné voit quelles agences ont consulté, la plus récente en tête', async ({
    client,
    assert,
  }) => {
    const { organization, owner, supplier, products } = await createSupplierWithProducts([
      'Stylo',
      'Gourde',
    ])
    await subscribeOrganization(organization)
    const early = await OrganizationFactory.merge({ name: 'Agence Ancienne' }).create()
    const recent = await OrganizationFactory.merge({ name: 'Agence Récente' }).create()
    await recordViews({ targetId: products[0].id, organizationId: early.id, daysAgo: 5 })
    await recordViews({ targetId: products[1].id, organizationId: early.id, daysAgo: 4 })
    await recordViews({ targetId: supplier.id, type: 'supplier_viewed', organizationId: recent.id })

    const response = await client.get(URL).withInertia().loginAs(owner)
    const { agencies } = response.inertiaProps.report

    assert.isNull(response.inertiaProps.upsell)
    assert.deepEqual(
      agencies.map((row: { name: string; views: number; products: number }) => [
        row.name,
        row.views,
        row.products,
      ]),
      [
        ['Agence Récente', 1, 0],
        ['Agence Ancienne', 2, 2],
      ]
    )
    assert.isString(agencies[0].lastViewedAt)
    assert.notProperty(agencies[0], 'organizationId')
  })

  test('au-delà de 90 jours, l’événement compte mais ne nomme plus l’agence', async ({
    client,
    assert,
  }) => {
    const { organization, owner, products } = await createSupplierWithProducts(['Stylo'])
    await subscribeOrganization(organization)
    const agency = await OrganizationFactory.merge({ name: 'Agence d’Antan' }).create()
    await recordViews({ targetId: products[0].id, organizationId: agency.id, daysAgo: 120 })

    const response = await client.get(`${URL}?period=365`).withInertia().loginAs(owner)
    const { report } = response.inertiaProps

    assert.equal(report.summary.productViews, 1)
    assert.deepEqual(report.agencies, [])
  })

  test('les consultations d’un autre fournisseur ne sont pas listées comme agence', async ({
    client,
    assert,
  }) => {
    const { organization, owner, products } = await createSupplierWithProducts(['Stylo'])
    await subscribeOrganization(organization)
    const competitor = await OrganizationFactory.apply('supplier').create()
    await recordViews({ targetId: products[0].id, organizationId: competitor.id })

    const response = await client.get(URL).withInertia().loginAs(owner)
    assert.deepEqual(response.inertiaProps.report.agencies, [])
  })
})
