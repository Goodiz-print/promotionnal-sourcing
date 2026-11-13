import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import type { ApiClient } from '@japa/api-client'
import { AdCampaignFactory } from '#database/factories/ad_campaign_factory'
import { CategoryFactory } from '#database/factories/category_factory'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { ProductFactory } from '#database/factories/product_factory'
import { SupplierFactory } from '#database/factories/supplier_factory'
import { UserFactory } from '#database/factories/user_factory'
import AdCampaign from '#models/ad_campaign'
import AdClick from '#models/ad_click'
import AdImpression from '#models/ad_impression'
import AdminAuditLog from '#models/admin_audit_log'
import type Organization from '#models/organization'
import type Product from '#models/product'
import type User from '#models/user'
import AdWalletService from '#services/ad_wallet_service'
import { AD_MIN_CPC_CENTS, type SponsoredProductType } from '#shared/types/ads'
import { installFakeAdPaymentGateway } from '#tests/utils/fake_ad_payment_gateway'
import { installFakeEngine } from '#tests/utils/fake_search_engine'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'

/**
 * Produits sponsorisés (cf. `docs/ads.md`) : diffusion par pertinence, enchère
 * au second prix, clic facturé, campagnes du fournisseur, recharge du
 * portefeuille et supervision.
 */

const BROWSER = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/130 Safari/537.36'
const OTHER_BROWSER = 'Mozilla/5.0 (Windows NT 10.0) Gecko/20100101 Firefox/131.0'

interface SponsoredOptions {
  maxCpcCents?: number
  dailyBudgetCents?: number
  /** Crédit initial du portefeuille (10 € par défaut ; 0 = portefeuille vide). */
  balanceCents?: number
  categoryId?: number
  madeInEurope?: boolean
  state?: 'paused' | 'suspended'
}

async function wallets(): Promise<AdWalletService> {
  return app.container.make(AdWalletService)
}

/** Solde du portefeuille publicitaire d'une organisation, en centimes. */
async function balanceOf(organizationId: number): Promise<number> {
  const service = await wallets()
  return service.balance(organizationId)
}

async function transactionsOf(organizationId: number) {
  const service = await wallets()
  return service.recentTransactions(organizationId, 10)
}

async function credit(organizationId: number, amountCents: number): Promise<void> {
  const service = await wallets()
  await service.apply(organizationId, amountCents, { type: 'adjustment' })
}

/** Produit publié d'une organisation fournisseuse qui lui est propre. */
async function supplierProduct(
  options: Pick<SponsoredOptions, 'categoryId' | 'madeInEurope'> = {}
): Promise<{ org: Organization; product: Product }> {
  const org = await OrganizationFactory.apply('supplier').create()
  const supplier = await SupplierFactory.merge({ organizationId: org.id }).create()
  const category = options.categoryId ? null : await CategoryFactory.create()
  const categoryId = options.categoryId ?? category!.id
  const product = await ProductFactory.merge({
    supplierId: supplier.id,
    categoryId,
    madeInEurope: options.madeInEurope ?? false,
  }).create()
  return { org, product }
}

/** Produit sponsorisé : produit + campagne active + portefeuille crédité. */
async function sponsoredProduct(options: SponsoredOptions = {}) {
  const { org, product } = await supplierProduct(options)
  const factory = AdCampaignFactory.merge({
    organizationId: org.id,
    productId: product.id,
    maxCpcCents: options.maxCpcCents ?? 50,
    dailyBudgetCents: options.dailyBudgetCents ?? 2000,
  })
  const campaign = await (options.state ? factory.apply(options.state) : factory).create()

  const balance = options.balanceCents ?? 1000
  if (balance > 0) await credit(org.id, balance)
  return { org, product, campaign }
}

async function catalogueSponsored(client: ApiClient, query = ''): Promise<SponsoredProductType[]> {
  const response = await client.get(`/fr/products${query}`).withInertia()
  response.assertStatus(200)
  return response.inertiaProps.sponsored
}

function click(client: ApiClient, url: string, userAgent = BROWSER) {
  return client.get(url).redirects(0).header('user-agent', userAgent)
}

test.group('Produits sponsorisés — diffusion', (group) => {
  useDatabase(group)

  test('un produit sponsorisé apparaît en tête du catalogue avec son lien de clic signé', async ({
    client,
    assert,
  }) => {
    const { product, campaign } = await sponsoredProduct()

    const sponsored = await catalogueSponsored(client)

    assert.lengthOf(sponsored, 1)
    assert.equal(sponsored[0].product.id, product.id)
    assert.include(sponsored[0].clickUrl, `/fr/ads/click/${campaign.id}`)
    assert.include(sponsored[0].clickUrl, 'signature=')
  })

  test('chaque affichage est compté pour la campagne', async ({ client, assert }) => {
    const { campaign } = await sponsoredProduct()

    await catalogueSponsored(client)
    await catalogueSponsored(client)

    const impression = await AdImpression.query()
      .where('campaignId', campaign.id)
      .where('placement', 'catalogue')
      .firstOrFail()
    assert.equal(impression.count, 2)
  })

  test('un produit sponsorisé qui ne respecte pas les filtres n’apparaît pas', async ({
    client,
    assert,
  }) => {
    const european = await sponsoredProduct({ madeInEurope: true, maxCpcCents: 20 })
    await sponsoredProduct({ madeInEurope: false, maxCpcCents: 300 })

    const sponsored = await catalogueSponsored(client, '?madeInEurope=true')

    // La meilleure enchère ne suffit pas : seul le produit pertinent remonte.
    assert.deepEqual(
      sponsored.map((item) => item.product.id),
      [european.product.id]
    )
  })

  test('le filtre catégorie s’applique aussi aux produits sponsorisés', async ({
    client,
    assert,
  }) => {
    const inCategory = await sponsoredProduct()
    await sponsoredProduct()

    const sponsored = await catalogueSponsored(
      client,
      `?categoryId=${inCategory.product.categoryId}`
    )

    assert.deepEqual(
      sponsored.map((item) => item.product.id),
      [inCategory.product.id]
    )
  })

  test('les produits sponsorisés ne sont servis que sur la première page', async ({
    client,
    assert,
  }) => {
    await sponsoredProduct()
    assert.lengthOf(await catalogueSponsored(client, '?page=2'), 0)
  })

  test('classement par enchère, au plus trois emplacements', async ({ client, assert }) => {
    const low = await sponsoredProduct({ maxCpcCents: 20 })
    const top = await sponsoredProduct({ maxCpcCents: 90 })
    const mid = await sponsoredProduct({ maxCpcCents: 60 })
    const second = await sponsoredProduct({ maxCpcCents: 70 })

    const sponsored = await catalogueSponsored(client)

    assert.deepEqual(
      sponsored.map((item) => item.product.id),
      [top.product.id, second.product.id, mid.product.id]
    )
    assert.notInclude(
      sponsored.map((item) => item.product.id),
      low.product.id
    )
  })

  test('une campagne en pause, suspendue, hors période ou sans crédit ne diffuse pas', async ({
    client,
    assert,
  }) => {
    await sponsoredProduct({ state: 'paused' })
    await sponsoredProduct({ state: 'suspended' })
    await sponsoredProduct({ balanceCents: 0 })
    // Solde inférieur à l'enchère maximale : pas de quoi payer un clic.
    await sponsoredProduct({ maxCpcCents: 200, balanceCents: 150 })
    const future = await sponsoredProduct()
    await future.campaign.merge({ startsOn: future.campaign.startsOn.plus({ days: 10 }) }).save()
    const ended = await sponsoredProduct()
    await ended.campaign.merge({ endsOn: ended.campaign.startsOn }).save()

    assert.lengthOf(await catalogueSponsored(client), 0)
  })

  test('un produit dépublié ne diffuse plus', async ({ client, assert }) => {
    const { product } = await sponsoredProduct()
    await product.merge({ isActive: false }).save()

    assert.lengthOf(await catalogueSponsored(client), 0)
  })

  test('avec un terme de recherche, le moteur juge la pertinence par mots-clés', async ({
    client,
    assert,
  }) => {
    const handle = installFakeEngine()
    try {
      const matching = await sponsoredProduct()
      const other = await sponsoredProduct({ maxCpcCents: 400 })
      // Le moteur ne retient que le premier produit pour ce terme.
      handle.engine.hits = { ids: [matching.product.id], total: 1 }

      const sponsored = await catalogueSponsored(client, '?search=stylo')

      assert.deepEqual(
        sponsored.map((item) => item.product.id),
        [matching.product.id]
      )
      const request = handle.engine.requests.find((entry) => entry.filter.ids !== undefined)!
      assert.equal(request.semanticRatio, 0)
      assert.sameMembers(request.filter.ids!, [matching.product.id, other.product.id])
    } finally {
      handle.restore()
    }
  })

  test('la fiche produit propose les produits sponsorisés de la même catégorie', async ({
    client,
    assert,
  }) => {
    const viewed = await sponsoredProduct()
    const sibling = await sponsoredProduct({ categoryId: viewed.product.categoryId })
    await sponsoredProduct()

    const response = await client.get(`/fr/products/${viewed.product.slug}`).withInertia()

    response.assertStatus(200)
    // Ni la fiche consultée, ni les produits d'une autre catégorie.
    assert.deepEqual(
      response.inertiaProps.sponsored.map((item: SponsoredProductType) => item.product.id),
      [sibling.product.id]
    )
  })

  test('l’accueil affiche les produits sponsorisés', async ({ client, assert }) => {
    const { product } = await sponsoredProduct()

    const response = await client.get('/fr').withInertia()

    response.assertStatus(200)
    assert.deepEqual(
      response.inertiaProps.sponsored.map((item: SponsoredProductType) => item.product.id),
      [product.id]
    )
  })
})

test.group('Produits sponsorisés — clic facturé', (group) => {
  useDatabase(group)

  async function clickUrlOf(client: ApiClient, productId: number): Promise<string> {
    const sponsored = await catalogueSponsored(client)
    return sponsored.find((item) => item.product.id === productId)!.clickUrl
  }

  test('le clic redirige vers la fiche et débite le portefeuille au second prix', async ({
    client,
    assert,
  }) => {
    const winner = await sponsoredProduct({ maxCpcCents: 90 })
    await sponsoredProduct({ maxCpcCents: 60 })

    const response = await click(client, await clickUrlOf(client, winner.product.id))

    response.assertStatus(302)
    response.assertHeader('location', `/fr/products/${winner.product.slug}`)
    // Enchère suivante (60) + 1 centime, pas l'enchère maximale (90).
    const recorded = await AdClick.query().where('campaignId', winner.campaign.id).firstOrFail()
    assert.isTrue(recorded.billed)
    assert.equal(recorded.costCents, 61)
    assert.equal(recorded.placement, 'catalogue')
    assert.equal(await balanceOf(winner.org.id), 1000 - 61)
  })

  test('seul en lice, le clic coûte le prix plancher', async ({ client, assert }) => {
    const { org, product } = await sponsoredProduct({ maxCpcCents: 300 })

    await click(client, await clickUrlOf(client, product.id))

    assert.equal(await balanceOf(org.id), 1000 - AD_MIN_CPC_CENTS)
  })

  test('le même visiteur qui reclique n’est facturé qu’une fois', async ({ client, assert }) => {
    const { org, product, campaign } = await sponsoredProduct()
    const url = await clickUrlOf(client, product.id)

    await click(client, url)
    const again = await click(client, url)

    again.assertStatus(302)
    const clicks = await AdClick.query().where('campaignId', campaign.id).orderBy('id')
    assert.deepEqual(
      clicks.map((entry) => [entry.billed, entry.unbilledReason]),
      [
        [true, null],
        [false, 'duplicate'],
      ]
    )
    assert.equal(await balanceOf(org.id), 1000 - AD_MIN_CPC_CENTS)
  })

  test('un autre visiteur est facturé à son tour', async ({ client, assert }) => {
    const { org, product } = await sponsoredProduct()
    const url = await clickUrlOf(client, product.id)

    await click(client, url, BROWSER)
    await click(client, url, OTHER_BROWSER)

    assert.equal(await balanceOf(org.id), 1000 - 2 * AD_MIN_CPC_CENTS)
  })

  test('un lien dont le prix a été modifié redirige sans rien facturer', async ({
    client,
    assert,
  }) => {
    const { org, product, campaign } = await sponsoredProduct()
    const url = await clickUrlOf(client, product.id)
    const tampered = url.replace(`c=${AD_MIN_CPC_CENTS}`, 'c=4000')
    assert.notEqual(tampered, url)

    const response = await click(client, tampered)

    response.assertStatus(302)
    response.assertHeader('location', `/fr/products/${product.slug}`)
    assert.lengthOf(await AdClick.query().where('campaignId', campaign.id), 0)
    assert.equal(await balanceOf(org.id), 1000)
  })

  test('le clic d’un robot n’est ni compté ni facturé', async ({ client, assert }) => {
    const { org, product, campaign } = await sponsoredProduct()

    const response = await click(client, await clickUrlOf(client, product.id), 'Googlebot/2.1')

    response.assertStatus(302)
    assert.lengthOf(await AdClick.query().where('campaignId', campaign.id), 0)
    assert.equal(await balanceOf(org.id), 1000)
  })

  test('un membre de l’organisation annonceuse n’est pas facturé', async ({ client, assert }) => {
    const { org, product, campaign } = await sponsoredProduct()
    const owner = await createMember(org, 'owner')

    await click(client, await clickUrlOf(client, product.id)).loginAs(owner)

    const recorded = await AdClick.query().where('campaignId', campaign.id).firstOrFail()
    assert.isFalse(recorded.billed)
    assert.equal(recorded.unbilledReason, 'own_organization')
    assert.equal(await balanceOf(org.id), 1000)
  })

  test('un membre de l’équipe plateforme n’est pas facturé', async ({ client, assert }) => {
    const { org, product, campaign } = await sponsoredProduct()
    const admin = await UserFactory.apply('platformAdmin').create()

    await click(client, await clickUrlOf(client, product.id)).loginAs(admin)

    const recorded = await AdClick.query().where('campaignId', campaign.id).firstOrFail()
    assert.equal(recorded.unbilledReason, 'staff')
    assert.equal(await balanceOf(org.id), 1000)
  })

  test('une campagne mise en pause après l’affichage n’est pas facturée', async ({
    client,
    assert,
  }) => {
    const { org, product, campaign } = await sponsoredProduct()
    const url = await clickUrlOf(client, product.id)
    await campaign.merge({ status: 'paused' }).save()

    await click(client, url)

    const recorded = await AdClick.query().where('campaignId', campaign.id).firstOrFail()
    assert.equal(recorded.unbilledReason, 'inactive')
    assert.equal(await balanceOf(org.id), 1000)
  })

  test('la campagne cesse de diffuser quand le budget du jour ne couvre plus un clic', async ({
    client,
    assert,
  }) => {
    // Budget 60, enchère max 50, clic à 10 : deux clics, puis 20 + 50 > 60.
    const { product } = await sponsoredProduct({ maxCpcCents: 50, dailyBudgetCents: 60 })

    await click(client, await clickUrlOf(client, product.id), BROWSER)
    await click(client, await clickUrlOf(client, product.id), OTHER_BROWSER)

    assert.lengthOf(await catalogueSponsored(client), 0)
  })

  test('la campagne cesse de diffuser quand le solde ne couvre plus l’enchère', async ({
    client,
    assert,
  }) => {
    const { org, product } = await sponsoredProduct({ maxCpcCents: 50, balanceCents: 50 })

    await click(client, await clickUrlOf(client, product.id))

    assert.equal(await balanceOf(org.id), 40)
    assert.lengthOf(await catalogueSponsored(client), 0)
  })

  test('une campagne inconnue renvoie au catalogue', async ({ client }) => {
    const response = await click(client, '/fr/ads/click/999999?p=catalogue&c=10')

    response.assertStatus(302)
    response.assertHeader('location', '/fr/products')
  })
})

test.group('Produits sponsorisés — campagnes du fournisseur', (group) => {
  useDatabase(group)

  async function supplierWithOwner() {
    const { org, product } = await supplierProduct()
    const owner = await createMember(org, 'owner')
    return { org, product, owner }
  }

  function send(
    client: ApiClient,
    method: 'post' | 'patch' | 'delete',
    url: string,
    user: User,
    payload: Record<string, unknown> = {}
  ) {
    return client[method](url)
      .withInertia()
      .withCsrfToken()
      .redirects(0)
      .loginAs(user)
      .json(payload)
  }

  const VALID = { maxCpc: 0.35, dailyBudget: 12.5, startsOn: '2026-11-11', endsOn: '2026-12-24' }

  test('le tableau de bord liste les campagnes, leurs statistiques et le solde', async ({
    client,
    assert,
  }) => {
    const { org, campaign } = await sponsoredProduct()
    const owner = await createMember(org, 'owner')

    const response = await client.get('/fr/supplier/ads').withInertia().loginAs(owner)

    response.assertStatus(200)
    response.assertInertiaComponent('supplier/ads/index')
    assert.equal(response.inertiaProps.wallet.balanceCents, 1000)
    assert.isFalse(response.inertiaProps.wallet.topUpEnabled)
    assert.lengthOf(response.inertiaProps.wallet.transactions, 1)
    assert.deepEqual(
      response.inertiaProps.campaigns.map((entry: { id: number }) => entry.id),
      [campaign.id]
    )
    assert.deepEqual(response.inertiaProps.campaigns[0].stats, {
      impressions: 0,
      clicks: 0,
      billedClicks: 0,
      spentCents: 0,
    })
  })

  test('crée une campagne : montants saisis en euros, stockés en centimes', async ({
    client,
    assert,
  }) => {
    const { org, product, owner } = await supplierWithOwner()

    const response = await send(client, 'post', '/fr/supplier/ads', owner, {
      productId: product.id,
      ...VALID,
    })

    response.assertStatus(302)
    response.assertHeader('location', '/fr/supplier/ads')
    const campaign = await AdCampaign.findByOrFail('productId', product.id)
    assert.equal(campaign.organizationId, org.id)
    assert.equal(campaign.status, 'active')
    assert.equal(campaign.maxCpcCents, 35)
    assert.equal(campaign.dailyBudgetCents, 1250)
    assert.equal(campaign.startsOn.toISODate(), '2026-11-11')
    assert.equal(campaign.endsOn?.toISODate(), '2026-12-24')
  })

  test('refuse un budget quotidien inférieur à l’enchère et une fin avant le début', async ({
    client,
    assert,
  }) => {
    const { product, owner } = await supplierWithOwner()

    await send(client, 'post', '/fr/supplier/ads', owner, {
      productId: product.id,
      ...VALID,
      maxCpc: 5,
      dailyBudget: 2,
    })
    await send(client, 'post', '/fr/supplier/ads', owner, {
      productId: product.id,
      ...VALID,
      endsOn: '2026-11-01',
    })
    // Enchère sous le prix plancher : rejetée par le validateur.
    await send(client, 'post', '/fr/supplier/ads', owner, {
      productId: product.id,
      ...VALID,
      maxCpc: 0.01,
    })

    assert.isNull(await AdCampaign.findBy('productId', product.id))
  })

  test('refuse le produit d’une autre organisation et un produit déjà en campagne', async ({
    client,
    assert,
  }) => {
    const { owner } = await supplierWithOwner()
    const foreign = await supplierProduct()
    const taken = await sponsoredProduct()
    const takenOwner = await createMember(taken.org, 'owner')

    await send(client, 'post', '/fr/supplier/ads', owner, {
      productId: foreign.product.id,
      ...VALID,
    })
    await send(client, 'post', '/fr/supplier/ads', takenOwner, {
      productId: taken.product.id,
      ...VALID,
    })

    assert.isNull(await AdCampaign.findBy('productId', foreign.product.id))
    assert.lengthOf(await AdCampaign.query().where('productId', taken.product.id), 1)
  })

  test('modifie, met en pause, relance puis supprime sa campagne', async ({ client, assert }) => {
    const { org, campaign } = await sponsoredProduct()
    const owner = await createMember(org, 'owner')
    const url = `/fr/supplier/ads/${campaign.id}`

    await send(client, 'patch', url, owner, { ...VALID, maxCpc: 1.2, endsOn: null })
    await campaign.refresh()
    assert.equal(campaign.maxCpcCents, 120)
    assert.isNull(campaign.endsOn)

    await send(client, 'patch', `${url}/status`, owner, { status: 'paused' })
    await campaign.refresh()
    assert.equal(campaign.status, 'paused')

    await send(client, 'patch', `${url}/status`, owner, { status: 'active' })
    await campaign.refresh()
    assert.equal(campaign.status, 'active')

    await send(client, 'delete', url, owner)
    assert.isNull(await AdCampaign.find(campaign.id))
  })

  test('une campagne suspendue par l’équipe ne se relance pas', async ({ client, assert }) => {
    const { org, campaign } = await sponsoredProduct({ state: 'suspended' })
    const owner = await createMember(org, 'owner')

    await send(client, 'patch', `/fr/supplier/ads/${campaign.id}/status`, owner, {
      status: 'active',
    })

    await campaign.refresh()
    assert.equal(campaign.status, 'suspended')
  })

  test('la campagne d’une autre organisation est introuvable', async ({ client, assert }) => {
    const { owner } = await supplierWithOwner()
    const other = await sponsoredProduct()

    const edit = await client.get(`/fr/supplier/ads/${other.campaign.id}/edit`).loginAs(owner)
    const destroy = await send(client, 'delete', `/fr/supplier/ads/${other.campaign.id}`, owner)

    edit.assertStatus(404)
    destroy.assertStatus(404)
    assert.isNotNull(await AdCampaign.find(other.campaign.id))
  })

  test('réservé aux owner/admin d’une organisation fournisseuse', async ({ client }) => {
    const { org } = await supplierWithOwner()
    const member = await createMember(org, 'member')
    const buyerOrg = await OrganizationFactory.create()
    const buyer = await createMember(buyerOrg, 'owner')

    const asMember = await client.get('/fr/supplier/ads').withInertia().loginAs(member)
    const asBuyer = await client.get('/fr/supplier/ads').withInertia().loginAs(buyer)

    asMember.assertStatus(403)
    asBuyer.assertStatus(403)
  })

  test('le menu du fournisseur propose les produits sponsorisés', async ({ client, assert }) => {
    const { owner } = await supplierWithOwner()

    const response = await client.get('/fr/dashboard').withInertia().loginAs(owner)

    const routes = response.inertiaProps.navigation.map((item: { route: string }) => item.route)
    assert.include(routes, 'supplier.ads.index')
  })
})

test.group('Produits sponsorisés — recharge du portefeuille', (group) => {
  useDatabase(group)

  let payment: ReturnType<typeof installFakeAdPaymentGateway>
  group.each.setup(() => {
    payment = installFakeAdPaymentGateway()
    return () => payment.restore()
  })

  test('la recharge ouvre la page de paiement hébergée, sans créditer le portefeuille', async ({
    client,
    assert,
  }) => {
    const { org } = await supplierProduct()
    const owner = await createMember(org, 'owner')

    const response = await client
      .post('/fr/supplier/ads/wallet/top-up')
      .withInertia()
      .withCsrfToken()
      .redirects(0)
      .loginAs(owner)
      .json({ amount: 50 })

    response.assertStatus(409)
    response.assertHeader('x-inertia-location', payment.gateway.checkoutUrl)
    assert.lengthOf(payment.gateway.checkouts, 1)
    assert.equal(payment.gateway.checkouts[0].organizationId, org.id)
    assert.equal(payment.gateway.checkouts[0].amountCents, 5000)
    // Le crédit n'arrive qu'avec la confirmation signée du prestataire.
    assert.equal(await balanceOf(org.id), 0)
  })

  test('refuse un montant hors bornes', async ({ client, assert }) => {
    const { org } = await supplierProduct()
    const owner = await createMember(org, 'owner')

    await client
      .post('/fr/supplier/ads/wallet/top-up')
      .withInertia()
      .withCsrfToken()
      .redirects(0)
      .loginAs(owner)
      .json({ amount: 1 })

    assert.lengthOf(payment.gateway.checkouts, 0)
  })

  test('la notification de paiement crédite le portefeuille, une seule fois', async ({
    client,
    assert,
  }) => {
    const { org } = await supplierProduct()
    payment.gateway.confirmation = {
      reference: 'stripe:cs_test_123',
      organizationId: org.id,
      amountCents: 5000,
    }

    // Sans jeton CSRF : la route est authentifiée par la signature du prestataire.
    const first = await client.post('/webhooks/stripe').json({ id: 'evt_1' })
    const replay = await client.post('/webhooks/stripe').json({ id: 'evt_1' })

    first.assertStatus(200)
    replay.assertStatus(200)
    assert.equal(await balanceOf(org.id), 5000)
    const transactions = await transactionsOf(org.id)
    assert.lengthOf(transactions, 1)
    assert.equal(transactions[0].type, 'top_up')
  })

  test('une notification à la signature invalide est rejetée', async ({ client, assert }) => {
    const { org } = await supplierProduct()
    payment.gateway.confirmation = new Error('invalid signature')

    const response = await client.post('/webhooks/stripe').json({ id: 'evt_1' })

    response.assertStatus(400)
    assert.equal(await balanceOf(org.id), 0)
  })
})

test.group('Produits sponsorisés — supervision (back-office)', (group) => {
  useDatabase(group)

  function post(client: ApiClient, url: string, user: User, payload: Record<string, unknown> = {}) {
    return client.post(url).withInertia().withCsrfToken().redirects(0).loginAs(user).json(payload)
  }

  test('l’admin voit toutes les campagnes et le solde de leur portefeuille', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { org, campaign } = await sponsoredProduct()

    const response = await client.get('/fr/admin/ads').withInertia().loginAs(admin)

    response.assertStatus(200)
    response.assertInertiaComponent('admin/ads/index')
    const [row] = response.inertiaProps.campaigns.data
    assert.equal(row.id, campaign.id)
    assert.equal(row.organizationId, org.id)
    assert.equal(row.walletBalanceCents, 1000)
  })

  test('réservé au droit `ads.manage`', async ({ client }) => {
    const support = await UserFactory.apply('platformSupport').create()

    const response = await client.get('/fr/admin/ads').withInertia().loginAs(support)

    response.assertStatus(403)
  })

  test('suspend puis rétablit une campagne, avec trace au journal d’audit', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { campaign } = await sponsoredProduct()

    await post(client, `/fr/admin/ads/${campaign.id}/suspend`, admin)
    await campaign.refresh()
    assert.equal(campaign.status, 'suspended')
    assert.lengthOf(await catalogueSponsored(client), 0)

    await post(client, `/fr/admin/ads/${campaign.id}/restore`, admin)
    await campaign.refresh()
    // Rétablie en pause : c'est au fournisseur de la relancer.
    assert.equal(campaign.status, 'paused')

    const actions = await AdminAuditLog.query()
      .where('targetType', 'ad_campaign')
      .where('targetId', campaign.id)
      .orderBy('id')
    assert.deepEqual(
      actions.map((entry) => entry.action),
      ['ad_campaign.suspended', 'ad_campaign.restored']
    )
  })

  test('crédite un portefeuille à la main, avec motif et trace d’audit', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { org } = await supplierProduct()

    await post(client, '/fr/admin/ads/wallets/adjust', admin, {
      organizationId: org.id,
      amount: 25,
      note: 'Virement reçu',
    })

    assert.equal(await balanceOf(org.id), 2500)
    const [transaction] = await transactionsOf(org.id)
    assert.equal(transaction.type, 'adjustment')
    assert.equal(transaction.note, 'Virement reçu')
    assert.equal(transaction.createdByUserId, admin.id)
    const audit = await AdminAuditLog.query()
      .where('action', 'ad_wallet.adjusted')
      .where('targetId', org.id)
      .firstOrFail()
    assert.equal(audit.actorUserId, admin.id)
  })

  test('un débit manuel ne peut pas dépasser le solde', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { org } = await sponsoredProduct({ balanceCents: 500 })

    await post(client, '/fr/admin/ads/wallets/adjust', admin, {
      organizationId: org.id,
      amount: -20,
      note: 'Correction',
    })

    assert.equal(await balanceOf(org.id), 500)
  })
})
