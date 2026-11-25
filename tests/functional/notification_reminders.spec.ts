import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import mail from '@adonisjs/mail/services/main'
import { NotificationFactory } from '#database/factories/notification_factory'
import { UserFactory } from '#database/factories/user_factory'
import SendMailJob from '#jobs/send_mail_job'
import SendNotificationRemindersJob from '#jobs/send_notification_reminders_job'
import NotificationReminderNotification from '#mails/notification_reminder_notification'
import Notification from '#models/notification'
import type User from '#models/user'
import NotificationReminderService from '#services/notification_reminder_service'
import type { Locale } from '#shared/types/i18n'
import {
  NOTIFICATION_REMINDER_MAX_AGE_HOURS,
  type NotificationType,
} from '#shared/types/notification'
import { useDatabase } from '#tests/utils/setup'

interface SentReminder {
  email: string
  locale: Locale
  path: string
  notificationMessage: string
}

const DUPLICATE_DATA = {
  organizationId: 42,
  organizationName: 'Acme',
  cancelledSubscriptionId: 'sub_dup',
}

/**
 * Fait échouer la mise en queue du `failOn`-ième mail (1-indexé) le temps de `run`.
 */
async function withFailingDispatch<T>(failOn: number, run: () => Promise<T>): Promise<T> {
  const original = SendMailJob.dispatch
  let calls = 0
  SendMailJob.dispatch = ((...args: Parameters<typeof original>) => {
    calls++
    if (calls === failOn) throw new Error('queue unavailable')
    return original.apply(SendMailJob, args)
  }) as typeof original
  try {
    return await run()
  } finally {
    SendMailJob.dispatch = original
  }
}

async function adminWith(locale: Locale = 'fr'): Promise<User> {
  return UserFactory.apply('platformAdmin').merge({ locale }).create()
}

async function notificationFor(
  user: User,
  type: NotificationType = 'subscription.duplicate_cancelled'
): Promise<Notification> {
  return NotificationFactory.merge({ userId: user.id, type, data: DUPLICATE_DATA }).create()
}

test.group('Notifications — rappel par mail des notifications non lues (#243)', (group) => {
  useDatabase(group)

  let sentMails: ReturnType<typeof mail.fake>['mails']
  group.each.setup(() => {
    sentMails = mail.fake().mails
    return () => mail.restore()
  })

  const reminders = () =>
    sentMails.sent(
      (m) => m instanceof NotificationReminderNotification
    ) as unknown as SentReminder[]

  test('une notification non lue après le délai déclenche un mail vers son destinataire', async ({
    assert,
  }) => {
    const admin = await adminWith('fr')
    const notification = await notificationFor(admin)
    const service = await app.container.make(NotificationReminderService)

    assert.equal(await service.sendDue(DateTime.now().plus({ minutes: 31 })), 1)

    const sent = reminders()
    assert.lengthOf(sent, 1)
    assert.equal(sent[0].email, admin.email)
    assert.equal(sent[0].locale, 'fr')
    assert.equal(sent[0].path, '/fr/admin/organizations/42')
    assert.include(sent[0].notificationMessage, 'Acme a payé deux abonnements')

    await notification.refresh()
    assert.isNotNull(notification.emailRemindedAt)
  })

  test('avant la fin du délai, aucun mail ne part', async ({ assert }) => {
    const admin = await adminWith()
    const notification = await notificationFor(admin)
    const service = await app.container.make(NotificationReminderService)

    assert.equal(await service.sendDue(DateTime.now().plus({ minutes: 10 })), 0)

    assert.lengthOf(reminders(), 0)
    await notification.refresh()
    assert.isNull(notification.emailRemindedAt)
  })

  test('une notification lue avant le délai ne déclenche aucun mail', async ({ assert }) => {
    const admin = await adminWith()
    await NotificationFactory.apply('read')
      .merge({ userId: admin.id, type: 'subscription.duplicate_cancelled', data: DUPLICATE_DATA })
      .create()
    const service = await app.container.make(NotificationReminderService)

    assert.equal(await service.sendDue(DateTime.now().plus({ hours: 2 })), 0)
    assert.lengthOf(reminders(), 0)
  })

  test('un type sans politique de rappel ne déclenche jamais de mail', async ({ assert }) => {
    const admin = await adminWith()
    await notificationFor(admin, 'rfq.received')
    const service = await app.container.make(NotificationReminderService)

    assert.equal(await service.sendDue(DateTime.now().plus({ days: 7 })), 0)
    assert.lengthOf(reminders(), 0)
  })

  test('une notification de commande est rappelée au bout de 24 h, sans rôle plateforme requis', async ({
    assert,
  }) => {
    const supplier = await UserFactory.merge({ locale: 'fr' }).create()
    await NotificationFactory.merge({
      userId: supplier.id,
      type: 'order.created',
      data: { orderId: 7, side: 'supplier' },
    }).create()
    const service = await app.container.make(NotificationReminderService)

    assert.equal(await service.sendDue(DateTime.now().plus({ hours: 23 })), 0)
    assert.equal(await service.sendDue(DateTime.now().plus({ hours: 25 })), 1)

    const sent = reminders()
    assert.lengthOf(sent, 1)
    assert.equal(sent[0].email, supplier.email)
    assert.equal(sent[0].path, '/fr/supplier/orders/7')
  })

  test('un rappel ne part qu’une fois, même si les passes se répètent', async ({ assert }) => {
    const admin = await adminWith()
    await notificationFor(admin)
    const service = await app.container.make(NotificationReminderService)
    const later = DateTime.now().plus({ minutes: 31 })

    assert.equal(await service.sendDue(later), 1)
    assert.equal(await service.sendDue(later), 0)
    assert.equal(await service.sendDue(later.plus({ days: 1 })), 0)

    assert.lengthOf(reminders(), 1)
  })

  test('le job planifié envoie le rappel dû, une seule fois sur deux passes', async ({
    assert,
  }) => {
    const admin = await adminWith()
    const notification = await notificationFor(admin)
    await Notification.query()
      .where('id', notification.id)
      .update({ createdAt: DateTime.now().minus({ minutes: 45 }).toSQL() })

    for (let pass = 0; pass < 2; pass++) {
      const job = await app.container.make(SendNotificationRemindersJob)
      await job.execute()
    }

    assert.lengthOf(reminders(), 1)
  })

  test('le mail est rédigé dans la langue de son destinataire', async ({ assert }) => {
    const english = await adminWith('en')
    const german = await adminWith('de')
    await notificationFor(english)
    await notificationFor(german)
    const service = await app.container.make(NotificationReminderService)

    assert.equal(await service.sendDue(DateTime.now().plus({ minutes: 31 })), 2)

    const byEmail = new Map(reminders().map((sent) => [sent.email, sent]))
    const en = byEmail.get(english.email)!
    const de = byEmail.get(german.email)!
    assert.equal(en.locale, 'en')
    assert.equal(en.path, '/en/admin/organizations/42')
    assert.include(en.notificationMessage, 'Acme paid for two subscriptions')
    assert.equal(de.locale, 'de')
    assert.include(de.notificationMessage, 'Acme hat zwei Abonnements')

    sentMails.assertSent(NotificationReminderNotification, (message) => {
      message.build()
      return message.message.hasSubject('Action needed: an important notification is still unread')
    })
  })

  test('un échec de mise en queue ne libère que sa notification, les autres gardent leur rappel', async ({
    assert,
  }) => {
    const admin = await adminWith()
    const notifications = [
      await notificationFor(admin),
      await notificationFor(admin),
      await notificationFor(admin),
    ]
    const service = await app.container.make(NotificationReminderService)
    const later = DateTime.now().plus({ minutes: 31 })

    assert.equal(await withFailingDispatch(2, () => service.sendDue(later)), 2)
    assert.lengthOf(reminders(), 2)

    for (const notification of notifications) await notification.refresh()
    const released = notifications.filter((n) => n.emailRemindedAt === null)
    assert.lengthOf(released, 1)

    // La passe suivante reprend la seule notification libérée.
    assert.equal(await service.sendDue(later), 1)
    assert.lengthOf(reminders(), 3)
    await released[0].refresh()
    assert.isNotNull(released[0].emailRemindedAt)
  })

  test('un destinataire qui n’a plus le rôle requis ne reçoit pas de rappel', async ({
    assert,
  }) => {
    const former = await adminWith()
    await notificationFor(former)
    former.platformRole = 'none'
    await former.save()
    const service = await app.container.make(NotificationReminderService)

    assert.equal(await service.sendDue(DateTime.now().plus({ minutes: 31 })), 0)
    assert.lengthOf(reminders(), 0)
  })

  test('une notification trop ancienne n’est plus rappelée', async ({ assert }) => {
    const admin = await adminWith()
    await notificationFor(admin)
    const service = await app.container.make(NotificationReminderService)

    assert.equal(
      await service.sendDue(
        DateTime.now().plus({ hours: NOTIFICATION_REMINDER_MAX_AGE_HOURS + 1 })
      ),
      0
    )
    assert.lengthOf(reminders(), 0)
  })
})

/**
 * Passes réellement concurrentes : sans transaction globale (`perTest: false`),
 * chaque `sendDue` a sa propre connexion et sa propre transaction, et
 * `FOR UPDATE SKIP LOCKED` départage les lignes. Les données restent en base
 * jusqu'à la remise à zéro du groupe suivant.
 */
test.group('Notifications — rappels sur passes concurrentes (#243)', (group) => {
  useDatabase(group, { perTest: false })

  test('deux passes simultanées n’envoient chaque rappel qu’une fois', async ({ assert }) => {
    const { mails } = mail.fake()
    try {
      const admin = await adminWith()
      const created = await NotificationFactory.merge({
        userId: admin.id,
        type: 'subscription.duplicate_cancelled',
        data: DUPLICATE_DATA,
      }).createMany(12)
      const service = await app.container.make(NotificationReminderService)
      const later = DateTime.now().plus({ minutes: 31 })

      const [first, second] = await Promise.all([service.sendDue(later), service.sendDue(later)])

      assert.equal(first + second, created.length)
      assert.lengthOf(
        mails.sent((m) => m instanceof NotificationReminderNotification),
        created.length
      )
      const pending = await Notification.query()
        .whereIn(
          'id',
          created.map((n) => n.id)
        )
        .whereNull('emailRemindedAt')
      assert.lengthOf(pending, 0)
    } finally {
      mail.restore()
    }
  })
})
