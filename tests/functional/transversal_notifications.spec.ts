import { test } from '@japa/runner'
import { NotificationFactory } from '#database/factories/notification_factory'
import { UserFactory } from '#database/factories/user_factory'
import NotificationService from '#services/notification_service'
import {
  NotificationNotFoundException,
  UnknownNotificationTypeException,
} from '#exceptions/notification_errors'
import { useDatabase } from '#tests/utils/setup'

test.group('Notifications in-app', (group) => {
  useDatabase(group)

  test('notify crée une notification non lue pour le destinataire', async ({ assert }) => {
    const user = await UserFactory.create()
    const service = new NotificationService()

    const notification = await service.notify(user, 'rfq.received', { rfqId: 12 })

    assert.equal(notification.userId, user.id)
    assert.equal(notification.type, 'rfq.received')
    assert.deepEqual(notification.data, { rfqId: 12 })
    assert.isNull(notification.readAt)
  })

  test('notify refuse un type inconnu, sans rien écrire', async ({ assert }) => {
    const user = await UserFactory.create()
    const service = new NotificationService()

    await assert.rejects(
      () => service.notify(user, 'inconnu' as never),
      UnknownNotificationTypeException
    )
    assert.equal(await service.unreadCount(user), 0)
  })

  test('unreadCount ne compte que les non lues de l’utilisateur', async ({ assert }) => {
    const user = await UserFactory.create()
    const other = await UserFactory.create()
    await NotificationFactory.merge({ userId: user.id }).createMany(2)
    await NotificationFactory.merge({ userId: user.id }).apply('read').create()
    await NotificationFactory.merge({ userId: other.id }).create()

    assert.equal(await new NotificationService().unreadCount(user), 2)
  })

  test('markRead est idempotent et conserve la première date de lecture', async ({ assert }) => {
    const user = await UserFactory.create()
    const notification = await NotificationFactory.merge({ userId: user.id }).create()
    const service = new NotificationService()

    const first = await service.markRead(user, notification.id)
    const firstReadAt = first.readAt?.toMillis()
    const second = await service.markRead(user, notification.id)

    assert.isNotNull(firstReadAt)
    assert.equal(second.readAt?.toMillis(), firstReadAt)
  })

  test('markRead sur la notification d’un autre utilisateur lève une erreur 404', async ({
    assert,
  }) => {
    const owner = await UserFactory.create()
    const intruder = await UserFactory.create()
    const notification = await NotificationFactory.merge({ userId: owner.id }).create()

    await assert.rejects(
      () => new NotificationService().markRead(intruder, notification.id),
      NotificationNotFoundException
    )
  })

  test('markAllRead ne touche que les non lues de l’utilisateur', async ({ assert }) => {
    const user = await UserFactory.create()
    const other = await UserFactory.create()
    await NotificationFactory.merge({ userId: user.id }).createMany(3)
    await NotificationFactory.merge({ userId: other.id }).create()
    const service = new NotificationService()

    await service.markAllRead(user)

    assert.equal(await service.unreadCount(user), 0)
    assert.equal(await service.unreadCount(other), 1)
  })

  test('listFor renvoie les plus récentes d’abord et filtre les non lues', async ({ assert }) => {
    const user = await UserFactory.create()
    await NotificationFactory.merge({ userId: user.id }).create()
    await NotificationFactory.merge({ userId: user.id }).create()
    const newest = await NotificationFactory.merge({ userId: user.id }).apply('read').create()
    const service = new NotificationService()

    const all = await service.listFor(user)
    const unread = await service.listFor(user, { unreadOnly: true })

    assert.lengthOf(all, 3)
    assert.equal(all[0].id, newest.id)
    assert.lengthOf(unread, 2)
  })
})
