import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import { dayInSubscriptionZone } from '#shared/helpers/subscription'
import SubscriptionActivatedNotification from '#mails/subscription_activated_notification'
import SubscriptionExpiringNotification from '#mails/subscription_expiring_notification'
import type Organization from '#models/organization'
import OrganizationSubscription from '#models/organization_subscription'
import SubscriptionMailService from '#services/subscription_mail_service'
import type {
  SubscriptionActivatedMailData,
  SubscriptionExpiringMailData,
} from '#shared/types/mail'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'

/**
 * Mails d'abonnement manuel (#237) : activation, puis rappels avant la fin
 * (30 jours pour un annuel, 7 jours pour tous), une seule fois chacun.
 */

interface SentActivation {
  email: string
  data: SubscriptionActivatedMailData
}

interface SentReminder {
  email: string
  data: SubscriptionExpiringMailData
}

async function supplierWithManagers(): Promise<Organization> {
  const org = await OrganizationFactory.apply('supplier').create()
  await createMember(org, 'owner')
  await createMember(org, 'admin')
  await createMember(org, 'member')
  return org
}

/** Abonnement manuel actif, de durée `months` mois, se terminant dans `endsInDays` jours. */
function activeFor(org: Organization, months: number, endsInDays: number) {
  const endsAt = DateTime.now().plus({ days: endsInDays })
  return OrganizationSubscription.create({
    organizationId: org.id,
    plan: 'business',
    status: 'active',
    origin: 'manual',
    startsAt: endsAt.minus({ months }),
    endsAt,
    activationNotifiedAt: DateTime.now().minus({ months }),
  })
}

test.group('Abonnements — mails d’activation et de rappel', (group) => {
  useDatabase(group)

  let sentMails: ReturnType<typeof mail.fake>['mails']
  group.each.setup(() => {
    sentMails = mail.fake().mails
    return () => mail.restore()
  })

  const activations = () =>
    sentMails.sent(
      (m) => m instanceof SubscriptionActivatedNotification
    ) as unknown as SentActivation[]
  const reminders = () =>
    sentMails.sent(
      (m) => m instanceof SubscriptionExpiringNotification
    ) as unknown as SentReminder[]
  const service = () => app.container.make(SubscriptionMailService)

  test('l’activation part une seule fois, vers les responsables (owner, admin)', async ({
    assert,
  }) => {
    const org = await supplierWithManagers()
    const subscription = await OrganizationSubscription.create({
      organizationId: org.id,
      plan: 'premium',
      status: 'active',
      origin: 'manual',
      startsAt: DateTime.now(),
      endsAt: DateTime.now().plus({ months: 1 }),
    })
    const mails = await service()

    assert.equal(await mails.notifyActivations(), 1)
    assert.equal(await mails.notifyActivations(), 0)

    const sent = activations()
    assert.lengthOf(sent, 2)
    assert.equal(sent[0].data.plan, 'premium')
    assert.equal(sent[0].data.organizationName, org.name)
    await subscription.refresh()
    assert.isNotNull(subscription.activationNotifiedAt)
  })

  test('un abonnement actif saisi par l’admin est annoncé tout de suite', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const org = await supplierWithManagers()

    await client
      .post(`/fr/admin/organizations/${org.id}/subscriptions`)
      .withInertia()
      .withCsrfToken()
      .redirects(0)
      .loginAs(admin)
      .json({
        plan: 'business',
        startsOn: dayInSubscriptionZone(),
        endsOn: dayInSubscriptionZone(DateTime.now().plus({ months: 1 }).toJSDate()),
      })

    assert.lengthOf(activations(), 2)
  })

  test('un abonnement programmé ou en ligne n’est pas annoncé', async ({ assert }) => {
    const org = await supplierWithManagers()
    const other = await supplierWithManagers()
    await OrganizationSubscription.create({
      organizationId: org.id,
      plan: 'business',
      status: 'scheduled',
      origin: 'manual',
      startsAt: DateTime.now().plus({ days: 3 }),
      endsAt: DateTime.now().plus({ months: 1 }),
    })
    await OrganizationSubscription.create({
      organizationId: other.id,
      plan: 'business',
      status: 'active',
      origin: 'stripe',
      stripeSubscriptionId: 'sub_mail_1',
      startsAt: DateTime.now(),
      endsAt: DateTime.now().plus({ months: 1 }),
    })

    const mails = await service()
    assert.equal(await mails.notifyActivations(), 0)
    assert.lengthOf(activations(), 0)
  })

  test('un abonnement mensuel reçoit un seul rappel, à 7 jours', async ({ assert }) => {
    const org = await supplierWithManagers()
    await activeFor(org, 1, 20)
    const mails = await service()

    assert.equal(await mails.remindExpiring(), 0)
    assert.equal(await mails.remindExpiring(DateTime.now().plus({ days: 14 })), 1)
    assert.equal(await mails.remindExpiring(DateTime.now().plus({ days: 15 })), 0)

    const sent = reminders()
    assert.lengthOf(sent, 2)
    assert.isAtMost(sent[0].data.daysLeft, 7)
  })

  test('un abonnement annuel reçoit deux rappels, à 30 puis à 7 jours', async ({ assert }) => {
    const org = await supplierWithManagers()
    await activeFor(org, 12, 40)
    const mails = await service()

    assert.equal(await mails.remindExpiring(DateTime.now().plus({ days: 11 })), 1)
    assert.equal(await mails.remindExpiring(DateTime.now().plus({ days: 12 })), 0)
    assert.equal(await mails.remindExpiring(DateTime.now().plus({ days: 34 })), 1)
    assert.equal(await mails.remindExpiring(DateTime.now().plus({ days: 35 })), 0)

    // Deux responsables par rappel.
    assert.deepEqual(
      reminders().map((m) => m.data.daysLeft),
      [29, 29, 6, 6]
    )
  })

  test('une prolongation annule le rappel de l’ancienne date et relance pour la nouvelle', async ({
    assert,
  }) => {
    const org = await supplierWithManagers()
    const subscription = await activeFor(org, 1, 5)
    const mails = await service()
    assert.equal(await mails.remindExpiring(), 1)

    subscription.endsAt = subscription.endsAt!.plus({ months: 1 })
    await subscription.save()

    assert.equal(await mails.remindExpiring(), 0)
    assert.equal(await mails.remindExpiring(DateTime.now().plus({ months: 1 })), 1)
    assert.lengthOf(reminders(), 4)
  })

  test('un abonnement résilié ne reçoit aucun rappel', async ({ assert }) => {
    const org = await supplierWithManagers()
    const subscription = await activeFor(org, 1, 5)
    subscription.status = 'cancelled'
    await subscription.save()

    const mails = await service()
    assert.equal(await mails.remindExpiring(), 0)
    assert.lengthOf(reminders(), 0)
  })
})
