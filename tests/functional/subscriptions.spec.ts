import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import type { ApiClient } from '@japa/api-client'
import { DateTime } from 'luxon'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import BillingProfile from '#models/billing_profile'
import Notification from '#models/notification'
import type Organization from '#models/organization'
import OrganizationSubscription from '#models/organization_subscription'
import StripeWebhookEvent from '#models/stripe_webhook_event'
import type User from '#models/user'
import NotificationService from '#services/notification_service'
import StripeWebhookEventService from '#services/stripe_webhook_event_service'
import SubscriptionService from '#services/subscription_service'
import type { BillingSubscriptionSnapshot } from '#shared/types/subscription'
import { installFakeSubscriptionBillingGateway } from '#tests/utils/fake_subscription_billing_gateway'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'
import NotificationTransformer from '#transformers/notification_transformer'

/**
 * Souscription en ligne des abonnements fournisseurs (#215, cf.
 * `docs/abonnements.md`) : page tarifs, client Stripe, page de souscription,
 * portail de facturation et notifications qui pilotent la formule.
 */

async function supplierOwner(): Promise<{ org: Organization; owner: User }> {
  const org = await OrganizationFactory.apply('supplier').create()
  const owner = await createMember(org, 'owner')
  return { org, owner }
}

function post(client: ApiClient, url: string, user: User, payload: Record<string, unknown> = {}) {
  return client.post(url).withInertia().withCsrfToken().redirects(0).loginAs(user).json(payload)
}

function snapshot(
  org: Organization,
  overrides: Partial<BillingSubscriptionSnapshot> = {}
): BillingSubscriptionSnapshot {
  return {
    id: 'sub_test_1',
    customerId: 'cus_test_1',
    providerStatus: 'active',
    plan: 'business',
    organizationId: org.id,
    currentPeriodStart: new Date('2026-11-01T00:00:00Z'),
    currentPeriodEnd: new Date('2026-12-01T00:00:00Z'),
    cancelAtPeriodEnd: false,
    canceledAt: null,
    ...overrides,
  }
}

async function planOf(org: Organization): Promise<string> {
  await org.refresh()
  return org.subscriptionPlan
}

test.group('Abonnements — page tarifs', (group) => {
  useDatabase(group)

  test('un fournisseur sans abonnement voit la grille et la formule gratuite', async ({
    client,
    assert,
  }) => {
    const { owner } = await supplierOwner()

    const response = await client.get('/fr/supplier/subscription').withInertia().loginAs(owner)

    response.assertStatus(200)
    response.assertInertiaComponent('supplier/subscription/show')
    assert.equal(response.inertiaProps.currentPlan, 'free')
    assert.isNull(response.inertiaProps.subscription)
    // Sans Stripe configuré (test, CI) : souscription en ligne désactivée.
    assert.isFalse(response.inertiaProps.onlineEnabled)
    assert.isFalse(response.inertiaProps.portalAvailable)
  })

  test('réservée aux propriétaires et administrateurs d’une organisation fournisseuse', async ({
    client,
  }) => {
    const { org } = await supplierOwner()
    const member = await createMember(org, 'member')
    const buyerOrg = await OrganizationFactory.create()
    const buyer = await createMember(buyerOrg, 'owner')

    const asMember = await client.get('/fr/supplier/subscription').withInertia().loginAs(member)
    const asBuyer = await client.get('/fr/supplier/subscription').withInertia().loginAs(buyer)

    asMember.assertStatus(403)
    asBuyer.assertStatus(403)
  })

  test('sans paiement en ligne configuré, la souscription renvoie un message', async ({
    client,
  }) => {
    const { owner } = await supplierOwner()

    const response = await post(client, '/fr/supplier/subscription/checkout', owner, {
      plan: 'business',
    })

    response.assertStatus(302)
    response.assertFlashMessage(
      'error',
      'La souscription en ligne n’est pas disponible pour le moment.'
    )
  })
})

test.group('Abonnements — souscription et portail', (group) => {
  useDatabase(group)

  let billing: ReturnType<typeof installFakeSubscriptionBillingGateway>
  group.each.setup(() => {
    billing = installFakeSubscriptionBillingGateway()
    return () => billing.restore()
  })

  test('la souscription crée le client Stripe, le conserve et ouvre la page hébergée', async ({
    client,
    assert,
  }) => {
    const { org, owner } = await supplierOwner()

    const response = await post(client, '/fr/supplier/subscription/checkout', owner, {
      plan: 'premium',
    })

    response.assertStatus(409)
    response.assertHeader('x-inertia-location', billing.gateway.checkoutUrl)
    assert.lengthOf(billing.gateway.customers, 1)
    assert.equal(billing.gateway.customers[0].organizationId, org.id)
    assert.lengthOf(billing.gateway.checkouts, 1)
    assert.equal(billing.gateway.checkouts[0].plan, 'premium')
    assert.equal(billing.gateway.checkouts[0].customerId, 'cus_test_1')
    assert.include(
      billing.gateway.checkouts[0].successUrl,
      '/fr/supplier/subscription?checkout=success'
    )

    const profile = await BillingProfile.findByOrFail('organizationId', org.id)
    assert.equal(profile.stripeCustomerId, 'cus_test_1')
    // La formule n'est accordée qu'à la notification signée.
    assert.equal(await planOf(org), 'free')
  })

  test('un simple membre ne peut ni souscrire ni ouvrir le portail', async ({ client, assert }) => {
    const { org } = await supplierOwner()
    await BillingProfile.create({ organizationId: org.id, stripeCustomerId: 'cus_existing' })
    const member = await createMember(org, 'member')

    const checkout = await post(client, '/fr/supplier/subscription/checkout', member, {
      plan: 'business',
    })
    const portal = await post(client, '/fr/supplier/subscription/portal', member)

    assert.notEqual(checkout.status(), 409)
    assert.notEqual(portal.status(), 409)
    assert.lengthOf(billing.gateway.customers, 0)
    assert.lengthOf(billing.gateway.checkouts, 0)
    assert.lengthOf(billing.gateway.portals, 0)
  })

  test('une seconde souscription réutilise le client existant', async ({ client, assert }) => {
    const { owner } = await supplierOwner()

    await post(client, '/fr/supplier/subscription/checkout', owner, { plan: 'business' })
    await post(client, '/fr/supplier/subscription/checkout', owner, { plan: 'premium' })

    assert.lengthOf(billing.gateway.customers, 1)
    assert.lengthOf(billing.gateway.checkouts, 2)
    assert.equal(billing.gateway.checkouts[1].customerId, 'cus_test_1')
  })

  test('refuse une formule inconnue ou gratuite', async ({ client, assert }) => {
    const { owner } = await supplierOwner()

    await post(client, '/fr/supplier/subscription/checkout', owner, { plan: 'free' })
    await post(client, '/fr/supplier/subscription/checkout', owner, { plan: 'gold' })

    assert.lengthOf(billing.gateway.checkouts, 0)
  })

  test('refuse un second abonnement quand un abonnement est en cours', async ({
    client,
    assert,
  }) => {
    const { org, owner } = await supplierOwner()
    billing.gateway.subscriptions.set('sub_test_1', snapshot(org))
    billing.gateway.event = {
      id: 'evt_1',
      type: 'customer.subscription.created',
      subscriptionId: 'sub_test_1',
    }
    await client.post('/webhooks/stripe').json({})

    const response = await post(client, '/fr/supplier/subscription/checkout', owner, {
      plan: 'premium',
    })

    response.assertStatus(302)
    response.assertFlashMessage(
      'error',
      'Vous avez déjà un abonnement en cours : changez de formule depuis le portail de facturation.'
    )
    assert.lengthOf(billing.gateway.checkouts, 0)
  })

  test('refuse une seconde souscription pendant la validation du premier paiement', async ({
    client,
    assert,
  }) => {
    const { org, owner } = await supplierOwner()
    billing.gateway.subscriptions.set('sub_test_1', snapshot(org, { providerStatus: 'incomplete' }))
    billing.gateway.event = {
      id: 'evt_1',
      type: 'customer.subscription.created',
      subscriptionId: 'sub_test_1',
    }
    await client.post('/webhooks/stripe').json({})

    const response = await post(client, '/fr/supplier/subscription/checkout', owner, {
      plan: 'premium',
    })

    response.assertStatus(302)
    response.assertFlashMessage(
      'error',
      'Un paiement d’abonnement est en cours de validation : finalisez-le depuis le portail de facturation ou réessayez plus tard.'
    )
    assert.lengthOf(billing.gateway.checkouts, 0)
  })

  test('le portail de facturation s’ouvre pour le client de l’organisation', async ({
    client,
    assert,
  }) => {
    const { org, owner } = await supplierOwner()
    await BillingProfile.create({ organizationId: org.id, stripeCustomerId: 'cus_existing' })

    const page = await client.get('/fr/supplier/subscription').withInertia().loginAs(owner)
    const response = await post(client, '/fr/supplier/subscription/portal', owner)

    assert.isTrue(page.inertiaProps.portalAvailable)
    response.assertStatus(409)
    response.assertHeader('x-inertia-location', billing.gateway.portalUrl)
    assert.deepEqual(billing.gateway.portals[0].customerId, 'cus_existing')
    assert.include(billing.gateway.portals[0].returnUrl, '/fr/supplier/subscription')
  })

  test('sans client Stripe, le portail renvoie un message', async ({ client, assert }) => {
    const { owner } = await supplierOwner()

    const response = await post(client, '/fr/supplier/subscription/portal', owner)

    response.assertStatus(302)
    response.assertFlashMessage(
      'error',
      'Aucun compte de facturation en ligne pour votre organisation.'
    )
    assert.lengthOf(billing.gateway.portals, 0)
  })
})

test.group('Abonnements — notifications Stripe', (group) => {
  useDatabase(group)

  let billing: ReturnType<typeof installFakeSubscriptionBillingGateway>
  group.each.setup(() => {
    billing = installFakeSubscriptionBillingGateway()
    return () => billing.restore()
  })

  /** Envoie une notification pour l'abonnement `sub_test_1`, dans l'état donné. */
  async function notify(
    client: ApiClient,
    eventId: string,
    state: BillingSubscriptionSnapshot,
    type = 'customer.subscription.updated'
  ) {
    billing.gateway.subscriptions.set(state.id, state)
    billing.gateway.event = { id: eventId, type, subscriptionId: state.id }
    // Sans jeton CSRF : la route est authentifiée par la signature du prestataire.
    return client.post('/webhooks/stripe').json({ id: eventId })
  }

  test('un abonnement actif accorde la formule et la page l’affiche', async ({
    client,
    assert,
  }) => {
    const { org, owner } = await supplierOwner()

    const response = await notify(client, 'evt_1', snapshot(org), 'customer.subscription.created')

    response.assertStatus(200)
    assert.equal(await planOf(org), 'business')
    const subscription = await OrganizationSubscription.findByOrFail('organizationId', org.id)
    assert.equal(subscription.status, 'active')
    assert.equal(subscription.origin, 'stripe')
    assert.equal(subscription.stripeSubscriptionId, 'sub_test_1')
    assert.equal(subscription.endsAt?.toISO(), DateTime.fromISO('2026-12-01T00:00:00Z').toISO())

    const service = await app.container.make(SubscriptionService)
    assert.isTrue(await service.isSubscribed(org.id))

    const page = await client.get('/fr/supplier/subscription').withInertia().loginAs(owner)
    assert.equal(page.inertiaProps.currentPlan, 'business')
    assert.equal(page.inertiaProps.subscription.status, 'active')
  })

  test('une notification rejouée n’est traitée qu’une fois', async ({ client, assert }) => {
    const { org } = await supplierOwner()

    const first = await notify(client, 'evt_1', snapshot(org))
    const replay = await notify(client, 'evt_1', snapshot(org))

    first.assertStatus(200)
    replay.assertStatus(200)
    assert.equal(billing.gateway.fetches, 1)
    assert.lengthOf(await StripeWebhookEvent.query().where('eventId', 'evt_1'), 1)
    assert.lengthOf(await OrganizationSubscription.query().where('organizationId', org.id), 1)
    assert.equal(await planOf(org), 'business')
  })

  test('des notifications distinctes sur le même état ne créent qu’un abonnement', async ({
    client,
    assert,
  }) => {
    const { org } = await supplierOwner()

    await notify(client, 'evt_1', snapshot(org), 'customer.subscription.created')
    await notify(client, 'evt_2', snapshot(org), 'invoice.paid')

    assert.lengthOf(await OrganizationSubscription.query().where('organizationId', org.id), 1)
    assert.equal(await planOf(org), 'business')
  })

  test('un changement de formule dans le portail met à jour la formule', async ({
    client,
    assert,
  }) => {
    const { org } = await supplierOwner()

    await notify(client, 'evt_1', snapshot(org))
    await notify(client, 'evt_2', snapshot(org, { plan: 'premium' }))

    assert.equal(await planOf(org), 'premium')
    const subscription = await OrganizationSubscription.findByOrFail('organizationId', org.id)
    assert.equal(subscription.plan, 'premium')
  })

  test('un impayé en cours de relance conserve la formule, signalé comme impayé', async ({
    client,
    assert,
  }) => {
    const { org } = await supplierOwner()

    await notify(client, 'evt_1', snapshot(org))
    await notify(
      client,
      'evt_2',
      snapshot(org, { providerStatus: 'past_due' }),
      'invoice.payment_failed'
    )

    assert.equal(await planOf(org), 'business')
    const subscription = await OrganizationSubscription.findByOrFail('organizationId', org.id)
    assert.equal(subscription.status, 'past_due')
    assert.equal(subscription.stripeStatus, 'past_due')
  })

  test('un impayé abandonné par Stripe repasse l’organisation en gratuit', async ({
    client,
    assert,
  }) => {
    const { org } = await supplierOwner()

    await notify(client, 'evt_1', snapshot(org))
    await notify(client, 'evt_2', snapshot(org, { providerStatus: 'unpaid' }))

    assert.equal(await planOf(org), 'free')
    const subscription = await OrganizationSubscription.findByOrFail('organizationId', org.id)
    assert.equal(subscription.status, 'cancelled')
    assert.isNotNull(subscription.cancelledAt)

    // Réglé finalement : l'abonnement redevient actif, la formule revient.
    await notify(client, 'evt_3', snapshot(org, { providerStatus: 'active' }), 'invoice.paid')
    assert.equal(await planOf(org), 'business')
  })

  test('une résiliation programmée garde la formule jusqu’à la fin de la période', async ({
    client,
    assert,
  }) => {
    const { org } = await supplierOwner()

    await notify(client, 'evt_1', snapshot(org))
    await notify(client, 'evt_2', snapshot(org, { cancelAtPeriodEnd: true }))

    assert.equal(await planOf(org), 'business')
    const subscription = await OrganizationSubscription.findByOrFail('organizationId', org.id)
    assert.isTrue(subscription.cancelAtPeriodEnd)
  })

  test('la résiliation effective repasse l’organisation en gratuit et garde l’historique', async ({
    client,
    assert,
  }) => {
    const { org } = await supplierOwner()

    await notify(client, 'evt_1', snapshot(org))
    await notify(
      client,
      'evt_2',
      snapshot(org, { providerStatus: 'canceled', canceledAt: new Date('2026-12-01T00:00:00Z') }),
      'customer.subscription.deleted'
    )

    assert.equal(await planOf(org), 'free')
    const subscriptions = await OrganizationSubscription.query().where('organizationId', org.id)
    assert.lengthOf(subscriptions, 1)
    assert.equal(subscriptions[0].status, 'cancelled')
    const service = await app.container.make(SubscriptionService)
    assert.isFalse(await service.isSubscribed(org.id))
  })

  test('un premier paiement non abouti n’accorde aucune formule', async ({ client, assert }) => {
    const { org } = await supplierOwner()

    await notify(client, 'evt_1', snapshot(org, { providerStatus: 'incomplete' }))

    assert.equal(await planOf(org), 'free')
    const subscription = await OrganizationSubscription.findByOrFail('organizationId', org.id)
    assert.equal(subscription.status, 'pending')
  })

  test('sans métadonnée, l’organisation est retrouvée par son client Stripe', async ({
    client,
    assert,
  }) => {
    const { org } = await supplierOwner()
    await BillingProfile.create({ organizationId: org.id, stripeCustomerId: 'cus_test_1' })

    await notify(client, 'evt_1', snapshot(org, { organizationId: null }))

    assert.equal(await planOf(org), 'business')
  })

  test('un abonnement en ligne remplace un abonnement saisi à la main', async ({
    client,
    assert,
  }) => {
    const { org } = await supplierOwner()
    await OrganizationSubscription.create({
      organizationId: org.id,
      plan: 'business',
      status: 'active',
      origin: 'manual',
      startsAt: DateTime.now().minus({ days: 10 }),
      endsAt: DateTime.now().plus({ days: 20 }),
      cancelAtPeriodEnd: false,
    })

    await notify(client, 'evt_1', snapshot(org, { plan: 'premium' }))

    assert.equal(await planOf(org), 'premium')
    const manual = await OrganizationSubscription.query()
      .where('organizationId', org.id)
      .where('origin', 'manual')
      .firstOrFail()
    assert.equal(manual.status, 'cancelled')
  })

  test('un second abonnement en ligne payé en parallèle est résilié chez Stripe', async ({
    client,
    assert,
  }) => {
    const { org } = await supplierOwner()
    const admin = await UserFactory.apply('platformAdmin').create()
    const moderator = await UserFactory.apply('platformModerator').create()
    // Deux pages de souscription payées dans deux onglets : Business puis Premium.
    await notify(client, 'evt_1', snapshot(org), 'customer.subscription.created')
    const duplicate = await notify(
      client,
      'evt_2',
      snapshot(org, { id: 'sub_test_2', plan: 'premium' }),
      'customer.subscription.created'
    )

    duplicate.assertStatus(200)
    // L'abonnement en place est gardé, le doublon résilié chez Stripe : un seul facturé.
    assert.deepEqual(billing.gateway.cancellations, ['sub_test_2'])
    assert.equal(await planOf(org), 'business')
    const rows = await OrganizationSubscription.query()
      .where('organizationId', org.id)
      .orderBy('id')
    assert.deepEqual(
      rows.map((row) => [row.stripeSubscriptionId, row.status]),
      [
        ['sub_test_1', 'active'],
        ['sub_test_2', 'cancelled'],
      ]
    )

    // Les administrateurs de la plateforme sont notifiés du remboursement à faire.
    const alerts = await Notification.query().where('type', 'subscription.duplicate_cancelled')
    assert.deepEqual(
      alerts.map((alert) => alert.userId),
      [admin.id]
    )
    assert.notEqual(alerts[0].userId, moderator.id)
    assert.deepInclude(alerts[0].data, {
      organizationId: org.id,
      organizationName: org.name,
      keptSubscriptionId: 'sub_test_1',
      cancelledSubscriptionId: 'sub_test_2',
    })
    assert.equal(
      new NotificationTransformer(alerts[0], 'fr').toObject().href,
      `/fr/admin/organizations/${org.id}`
    )

    // Les échéances suivantes ne font plus basculer la formule.
    await notify(client, 'evt_3', snapshot(org), 'invoice.paid')
    await notify(
      client,
      'evt_4',
      billing.gateway.subscriptions.get('sub_test_2')!,
      'customer.subscription.deleted'
    )
    assert.equal(await planOf(org), 'business')
    assert.lengthOf(billing.gateway.cancellations, 1)
    assert.lengthOf(await Notification.query().where('type', 'subscription.duplicate_cancelled'), 1)
  })

  test('un nouvel abonnement remplace l’ancien déjà résilié chez Stripe', async ({
    client,
    assert,
  }) => {
    const { org } = await supplierOwner()
    await notify(client, 'evt_1', snapshot(org), 'customer.subscription.created')
    // Résilié dans le portail, mais sa notification n'est pas encore arrivée.
    billing.gateway.subscriptions.set(
      'sub_test_1',
      snapshot(org, { providerStatus: 'canceled', canceledAt: new Date() })
    )

    await notify(
      client,
      'evt_2',
      snapshot(org, { id: 'sub_test_2', plan: 'premium' }),
      'customer.subscription.created'
    )

    assert.lengthOf(billing.gateway.cancellations, 0)
    assert.lengthOf(await Notification.query().where('type', 'subscription.duplicate_cancelled'), 0)
    assert.equal(await planOf(org), 'premium')
    const rows = await OrganizationSubscription.query()
      .where('organizationId', org.id)
      .orderBy('id')
    assert.deepEqual(
      rows.map((row) => [row.stripeSubscriptionId, row.status]),
      [
        ['sub_test_1', 'cancelled'],
        ['sub_test_2', 'active'],
      ]
    )
  })

  test('une alerte en échec n’empêche pas d’enregistrer la résiliation du doublon', async ({
    client,
    assert,
  }) => {
    const { org } = await supplierOwner()
    await UserFactory.apply('platformAdmin').create()
    const notifications = await app.container.make(NotificationService)
    app.container.swap(NotificationService, () => {
      notifications.notify = async () => {
        throw new Error('notifications down')
      }
      return notifications
    })

    try {
      await notify(client, 'evt_1', snapshot(org), 'customer.subscription.created')
      const response = await notify(
        client,
        'evt_2',
        snapshot(org, { id: 'sub_test_2', plan: 'premium' }),
        'customer.subscription.created'
      )

      response.assertStatus(200)
      assert.deepEqual(billing.gateway.cancellations, ['sub_test_2'])
      const duplicate = await OrganizationSubscription.findByOrFail(
        'stripeSubscriptionId',
        'sub_test_2'
      )
      assert.equal(duplicate.status, 'cancelled')
    } finally {
      app.container.restore(NotificationService)
    }
  })

  test('une résiliation chez Stripe en échec laisse Stripe renvoyer la notification', async ({
    client,
    assert,
  }) => {
    const { org } = await supplierOwner()
    await notify(client, 'evt_1', snapshot(org), 'customer.subscription.created')
    billing.gateway.cancelSubscription = async () => {
      throw new Error('stripe unavailable')
    }

    const response = await notify(
      client,
      'evt_2',
      snapshot(org, { id: 'sub_test_2', plan: 'premium' }),
      'customer.subscription.created'
    )

    response.assertStatus(400)
    assert.lengthOf(await StripeWebhookEvent.query().where('eventId', 'evt_2'), 0)
    assert.lengthOf(
      await OrganizationSubscription.query().where('stripeSubscriptionId', 'sub_test_2'),
      0
    )
    assert.equal(await planOf(org), 'business')
  })

  test('deux abonnements en cours simultanés sont refusés par la base', async ({ assert }) => {
    const { org } = await supplierOwner()
    const row = {
      organization_id: org.id,
      plan: 'business',
      status: 'active',
      origin: 'manual',
      starts_at: new Date(),
      cancel_at_period_end: false,
      created_at: new Date(),
    }
    await db.table('organization_subscriptions').insert(row)

    await assert.rejects(() =>
      db.table('organization_subscriptions').insert({ ...row, status: 'past_due' })
    )
  })

  test('une notification à la signature invalide est rejetée', async ({ client, assert }) => {
    const { org } = await supplierOwner()
    billing.gateway.event = new Error('invalid signature')

    const response = await client.post('/webhooks/stripe').json({ id: 'evt_1' })

    response.assertStatus(400)
    assert.equal(await planOf(org), 'free')
  })

  test('un échec de traitement laisse Stripe renvoyer la notification', async ({
    client,
    assert,
  }) => {
    const { org } = await supplierOwner()
    // Abonnement introuvable chez le prestataire : la relecture échoue.
    billing.gateway.event = { id: 'evt_1', type: 'invoice.paid', subscriptionId: 'sub_missing' }

    const failed = await client.post('/webhooks/stripe').json({ id: 'evt_1' })

    failed.assertStatus(400)
    // L'événement n'est pas marqué traité : le renvoi sera traité.
    assert.lengthOf(await StripeWebhookEvent.query().where('eventId', 'evt_1'), 0)

    const retried = await notify(
      client,
      'evt_1',
      snapshot(org, { id: 'sub_missing' }),
      'invoice.paid'
    )
    retried.assertStatus(200)
    assert.equal(await planOf(org), 'business')
  })
})

test.group('Abonnements — purge des notifications traitées', (group) => {
  useDatabase(group)

  test('supprime les notifications au-delà de 30 jours, garde les récentes', async ({ assert }) => {
    const now = new Date('2026-11-20T00:00:00Z')
    await db.table('stripe_webhook_events').multiInsert([
      { event_id: 'evt_old', type: 'invoice.paid', created_at: new Date('2026-10-20T00:00:00Z') },
      {
        event_id: 'evt_recent',
        type: 'invoice.paid',
        created_at: new Date('2026-11-01T00:00:00Z'),
      },
    ])

    const service = await app.container.make(StripeWebhookEventService)
    const deleted = await service.purge(now)

    assert.equal(deleted, 1)
    const left = await db.from('stripe_webhook_events').select('event_id')
    assert.deepEqual(
      left.map((row) => row.event_id),
      ['evt_recent']
    )
  })
})
