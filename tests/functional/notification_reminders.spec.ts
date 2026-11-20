import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import mail from '@adonisjs/mail/services/main'
import { NotificationFactory } from '#database/factories/notification_factory'
import { UserFactory } from '#database/factories/user_factory'
import SendNotificationRemindersJob from '#jobs/send_notification_reminders_job'
import NotificationReminderNotification from '#mails/notification_reminder_notification'
import Notification from '#models/notification'
import type User from '#models/user'
import NotificationReminderService from '#services/notification_reminder_service'
import type { Locale } from '#shared/types/i18n'
import type { NotificationType } from '#shared/types/notification'
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

    await new SendNotificationRemindersJob().execute()
    await new SendNotificationRemindersJob().execute()

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
})
