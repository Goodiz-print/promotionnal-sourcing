import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import type { ApiClient } from '@japa/api-client'
import { DateTime } from 'luxon'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import AdminAuditLog from '#models/admin_audit_log'
import type Organization from '#models/organization'
import OrganizationSubscription from '#models/organization_subscription'
import type User from '#models/user'
import ManualSubscriptionService from '#services/manual_subscription_service'
import SubscriptionService from '#services/subscription_service'
import { dayInSubscriptionZone } from '#shared/helpers/subscription'
import { SUBSCRIPTION_TIMEZONE } from '#shared/types/subscription'
import { useDatabase } from '#tests/utils/setup'

/**
 * Abonnements manuels saisis par l'admin (#214, cf. `docs/abonnements.md`) :
 * saisie datée, prolongation, résiliation, activation et expiration planifiées,
 * et règle unique « abonné ou non ».
 */

interface AdminRequest {
  method?: 'post' | 'patch'
  url: string
  user: User
  payload?: Record<string, unknown>
}

const day = (offsetDays: number) =>
  dayInSubscriptionZone(DateTime.now().plus({ days: offsetDays }).toJSDate())

/** Début (heure de Paris) du jour situé `offsetDays` jours plus loin. */
const startOf = (offsetDays: number) =>
  DateTime.fromISO(day(offsetDays), { zone: SUBSCRIPTION_TIMEZONE }).toMillis()

function send(client: ApiClient, { method = 'post', url, user, payload = {} }: AdminRequest) {
  return client[method](url).withInertia().withCsrfToken().redirects(0).loginAs(user).json(payload)
}

const storeUrl = (org: Organization) => `/fr/admin/organizations/${org.id}/subscriptions`
const subscriptionUrl = (org: Organization, subscription: OrganizationSubscription) =>
  `${storeUrl(org)}/${subscription.id}`

async function planOf(org: Organization): Promise<string> {
  await org.refresh()
  return org.subscriptionPlan
}

async function syncDue() {
  const service = await app.container.make(ManualSubscriptionService)
  return service.syncDue()
}

/** Abonnement manuel inséré directement, pour placer ses dates dans le passé. */
function manualRow(org: Organization, overrides: Partial<OrganizationSubscription> = {}) {
  return OrganizationSubscription.create({
    organizationId: org.id,
    plan: 'business',
    status: 'active',
    origin: 'manual',
    startsAt: DateTime.now().minus({ days: 30 }),
    endsAt: DateTime.now().plus({ days: 30 }),
    ...overrides,
  })
}

test.group('Abonnements manuels — saisie admin', (group) => {
  useDatabase(group)

  test('un admin crée un abonnement qui commence aujourd’hui : actif, formule à jour, tracé', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const org = await OrganizationFactory.apply('supplier').create()

    const response = await send(client, {
      url: storeUrl(org),
      user: admin,
      payload: { plan: 'premium', startsOn: day(0), endsOn: day(30) },
    })

    response.assertStatus(302)
    const subscription = await OrganizationSubscription.findByOrFail('organizationId', org.id)
    assert.equal(subscription.status, 'active')
    assert.equal(subscription.origin, 'manual')
    assert.equal(subscription.createdByUserId, admin.id)
    // Fin exclusive : début du jour qui suit le dernier jour saisi, heure de Paris.
    assert.equal(subscription.endsAt!.toMillis(), startOf(31))
    assert.equal(await planOf(org), 'premium')
    assert.isTrue(await new SubscriptionService().isSubscribed(org.id))

    const log = await AdminAuditLog.findByOrFail('action', 'subscription.created')
    assert.equal(log.targetId, org.id)
  })

  test('un jour de début futur programme l’abonnement, sans droit avant son activation', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const org = await OrganizationFactory.apply('supplier').create()

    await send(client, {
      url: storeUrl(org),
      user: admin,
      payload: { plan: 'business', startsOn: day(5), endsOn: day(40) },
    })

    const subscription = await OrganizationSubscription.findByOrFail('organizationId', org.id)
    assert.equal(subscription.status, 'scheduled')
    assert.equal(await planOf(org), 'free')
    assert.isFalse(await new SubscriptionService().isSubscribed(org.id))
  })

  test('un second abonnement est refusé tant qu’un autre est ouvert', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const org = await OrganizationFactory.apply('supplier').create()
    await manualRow(org)

    await send(client, {
      url: storeUrl(org),
      user: admin,
      payload: { plan: 'premium', startsOn: day(1), endsOn: day(60) },
    })

    const rows = await OrganizationSubscription.query().where('organizationId', org.id)
    assert.lengthOf(rows, 1)
  })

  test('des dates incohérentes ou une organisation acheteuse sont refusées', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const supplier = await OrganizationFactory.apply('supplier').create()
    const buyer = await OrganizationFactory.create()

    await send(client, {
      url: storeUrl(supplier),
      user: admin,
      payload: { plan: 'business', startsOn: day(10), endsOn: day(5) },
    })
    await send(client, {
      url: storeUrl(buyer),
      user: admin,
      payload: { plan: 'business', startsOn: day(0), endsOn: day(30) },
    })

    const rows = await OrganizationSubscription.query().whereIn('organizationId', [
      supplier.id,
      buyer.id,
    ])
    assert.lengthOf(rows, 0)
  })

  test('un utilisateur sans droit de gestion ne peut rien modifier', async ({ client, assert }) => {
    const support = await UserFactory.apply('platformSupport').create()
    const user = await UserFactory.create()
    const org = await OrganizationFactory.apply('supplier').create()
    const payload = { plan: 'business', startsOn: day(0), endsOn: day(30) }

    const responses = await Promise.all(
      [support, user].map((actor) =>
        client
          .post(storeUrl(org))
          .header('Accept', 'application/json')
          .withCsrfToken()
          .loginAs(actor)
          .json(payload)
      )
    )

    responses.forEach((response) => response.assertStatus(403))
    assert.lengthOf(await OrganizationSubscription.query().where('organizationId', org.id), 0)
  })

  test('la prolongation change la date de fin ; une fin passée est refusée', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const org = await OrganizationFactory.apply('supplier').create()
    const subscription = await manualRow(org)
    const url = subscriptionUrl(org, subscription)

    await send(client, { method: 'patch', url, user: admin, payload: { endsOn: day(90) } })
    await subscription.refresh()
    assert.equal(subscription.endsAt!.toMillis(), startOf(91))

    await send(client, { method: 'patch', url, user: admin, payload: { endsOn: day(-2) } })
    await subscription.refresh()
    assert.equal(subscription.endsAt!.toMillis(), startOf(91))
    assert.isNotNull(await AdminAuditLog.findBy('action', 'subscription.extended'))
  })

  test('la résiliation repasse l’organisation en gratuit', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const org = await OrganizationFactory.apply('supplier').create()
    const subscription = await manualRow(org, { plan: 'premium' })
    await db.transaction((trx) => new SubscriptionService().refreshPlan(org.id, trx))
    assert.equal(await planOf(org), 'premium')

    await send(client, { url: `${subscriptionUrl(org, subscription)}/cancel`, user: admin })

    await subscription.refresh()
    assert.equal(subscription.status, 'cancelled')
    assert.isNotNull(subscription.cancelledAt)
    assert.equal(await planOf(org), 'free')
  })

  test('un abonnement en ligne ne se modifie pas depuis le back-office', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const org = await OrganizationFactory.apply('supplier').create()
    const online = await manualRow(org, { origin: 'stripe', stripeSubscriptionId: 'sub_admin_1' })

    await send(client, { url: `${subscriptionUrl(org, online)}/cancel`, user: admin })

    await online.refresh()
    assert.equal(online.status, 'active')
  })

  test('la fiche admin expose l’historique des abonnements', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const org = await OrganizationFactory.apply('supplier').create()
    await manualRow(org, {
      status: 'expired',
      startsAt: DateTime.now().minus({ days: 90 }),
      endsAt: DateTime.now().minus({ days: 60 }),
    })
    await manualRow(org, { createdByUserId: admin.id })

    const response = await client
      .get(`/fr/admin/organizations/${org.id}`)
      .withInertia()
      .loginAs(admin)

    const history = response.inertiaProps.organization.subscriptions
    assert.deepEqual(
      history.map((s: { status: string; editable: boolean }) => [s.status, s.editable]),
      [
        ['active', true],
        ['expired', false],
      ]
    )
    assert.equal(history[0].createdByEmail, admin.email)
  })
})

test.group('Abonnements manuels — règle et passage planifié', (group) => {
  useDatabase(group)

  test('règle « abonné » : actif oui ; programmé, expiré, résilié, échu non', async ({
    assert,
  }) => {
    const service = new SubscriptionService()
    const cases: Array<[Partial<OrganizationSubscription>, boolean]> = [
      [{ status: 'active' }, true],
      [{ status: 'past_due' }, true],
      [{ status: 'scheduled', startsAt: DateTime.now().plus({ days: 2 }) }, false],
      [{ status: 'expired' }, false],
      [{ status: 'cancelled' }, false],
      // Échu mais pas encore expiré par le job : ne compte déjà plus.
      [{ status: 'active', endsAt: DateTime.now().minus({ hours: 1 }) }, false],
    ]

    const orgs = await OrganizationFactory.apply('supplier').createMany(cases.length)
    await Promise.all(cases.map(([overrides], index) => manualRow(orgs[index], overrides)))
    const subscribed = await service.subscribedAmong(orgs.map((org) => org.id))
    const single = await Promise.all(orgs.map((org) => service.isSubscribed(org.id)))

    cases.forEach(([overrides, expected], index) => {
      assert.equal(single[index], expected, String(overrides.status))
      assert.equal(subscribed.has(orgs[index].id), expected, String(overrides.status))
    })
  })

  test('une date de fin d’abonnement en ligne n’est pas lue par la règle', async ({ assert }) => {
    const org = await OrganizationFactory.apply('supplier').create()
    await manualRow(org, {
      origin: 'stripe',
      stripeSubscriptionId: 'sub_rule_1',
      status: 'past_due',
      endsAt: DateTime.now().minus({ days: 2 }),
    })

    assert.isTrue(await new SubscriptionService().isSubscribed(org.id))
  })

  test('deux abonnements en cours ou deux programmés sont impossibles en base', async ({
    assert,
  }) => {
    const org = await OrganizationFactory.apply('supplier').create()
    await manualRow(org)
    await manualRow(org, { status: 'scheduled', startsAt: DateTime.now().plus({ days: 40 }) })

    await assert.rejects(() => manualRow(org))
    await assert.rejects(() =>
      manualRow(org, { status: 'scheduled', startsAt: DateTime.now().plus({ days: 80 }) })
    )
  })

  test('le passage expire les échus, active les programmés et reste idempotent', async ({
    assert,
  }) => {
    const ending = await OrganizationFactory.apply('supplier').create()
    const starting = await OrganizationFactory.apply('supplier').create()
    const online = await OrganizationFactory.apply('supplier').create()
    const expiring = await manualRow(ending, { endsAt: DateTime.now().minus({ minutes: 5 }) })
    const scheduled = await manualRow(starting, {
      plan: 'premium',
      status: 'scheduled',
      startsAt: DateTime.now().minus({ minutes: 5 }),
    })
    const stripe = await manualRow(online, {
      origin: 'stripe',
      stripeSubscriptionId: 'sub_sync_1',
      endsAt: DateTime.now().minus({ days: 1 }),
    })
    await db.transaction((trx) => new SubscriptionService().refreshPlan(ending.id, trx))

    const result = await syncDue()
    const again = await syncDue()

    assert.deepEqual(result, { expired: [expiring.id], activated: [scheduled.id] })
    assert.deepEqual(again, { expired: [], activated: [] })
    await Promise.all([expiring.refresh(), scheduled.refresh(), stripe.refresh()])
    assert.equal(expiring.status, 'expired')
    assert.equal(scheduled.status, 'active')
    assert.equal(stripe.status, 'active')
    assert.equal(await planOf(ending), 'free')
    assert.equal(await planOf(starting), 'premium')
  })

  test('un renouvellement programmé prend le relais de l’abonnement qui se termine', async ({
    assert,
  }) => {
    const org = await OrganizationFactory.apply('supplier').create()
    const now = DateTime.now()
    const first = await manualRow(org, { endsAt: now.minus({ minutes: 1 }) })
    const renewal = await manualRow(org, {
      status: 'scheduled',
      plan: 'premium',
      startsAt: now.minus({ minutes: 1 }),
      endsAt: now.plus({ days: 30 }),
    })

    await syncDue()

    await Promise.all([first.refresh(), renewal.refresh()])
    assert.equal(first.status, 'expired')
    assert.equal(renewal.status, 'active')
    assert.equal(await planOf(org), 'premium')
  })
})
