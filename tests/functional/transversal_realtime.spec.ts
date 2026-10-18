import { test } from '@japa/runner'
import { NotificationFactory } from '#database/factories/notification_factory'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import ConversationService from '#services/conversation_service'
import NotificationService from '#services/notification_service'
import RealtimeService from '#services/realtime_service'
import { joinOrganization } from '#tests/utils/organizations'
import { userNotificationsChannel, conversationChannel } from '#shared/types/realtime'
import type { RealtimeEvent } from '#shared/types/realtime'
import { useDatabase } from '#tests/utils/setup'

/** Realtime qui enregistre les diffusions au lieu d'émettre sur Transmit. */
class RecordingRealtime extends RealtimeService {
  readonly sent: Array<{ channel: string; event: RealtimeEvent }> = []

  override notifyUser(
    userId: number,
    event: Extract<RealtimeEvent, { type: 'notification.created' }>
  ) {
    this.sent.push({ channel: userNotificationsChannel(userId), event })
  }

  override messagePosted(
    conversationId: number,
    event: Extract<RealtimeEvent, { type: 'message.posted' }>
  ) {
    this.sent.push({ channel: conversationChannel(conversationId), event })
  }
}

test.group('Temps réel — diffusion', (group) => {
  useDatabase(group)

  test('notify diffuse un événement sur le canal de l’utilisateur, sans contenu', async ({
    assert,
  }) => {
    const user = await UserFactory.create()
    const realtime = new RecordingRealtime()

    const notification = await new NotificationService(realtime).notify(user, 'rfq.received', {
      rfqId: 3,
    })

    assert.lengthOf(realtime.sent, 1)
    assert.equal(realtime.sent[0].channel, `notifications/users/${user.id}`)
    assert.deepEqual(realtime.sent[0].event, {
      type: 'notification.created',
      notificationId: notification.id,
      notificationType: 'rfq.received',
    })
  })

  test('un message diffuse sur le canal du fil, à la création comme à la réponse', async ({
    assert,
  }) => {
    const buyer = await OrganizationFactory.create()
    const supplier = await OrganizationFactory.apply('supplier').create()
    const buyerUser = await UserFactory.create()
    const supplierUser = await UserFactory.create()
    await joinOrganization(buyerUser, buyer, 'member')
    await joinOrganization(supplierUser, supplier, 'member')
    const realtime = new RecordingRealtime()
    const service = new ConversationService(realtime)

    const conversation = await service.start({
      buyerOrganizationId: buyer.id,
      supplierOrganizationId: supplier.id,
      author: buyerUser,
      body: 'Bonjour',
    })
    await service.post(conversation, supplierUser, 'Bonjour à vous')

    assert.lengthOf(realtime.sent, 2)
    assert.isTrue(
      realtime.sent.every((item) => item.channel === `conversations/${conversation.id}`)
    )
    assert.equal((realtime.sent[1].event as { authorUserId: number }).authorUserId, supplierUser.id)
  })
})

test.group('Temps réel — autorisation des canaux', (group) => {
  useDatabase(group)

  test('un utilisateur ne peut s’abonner qu’à ses propres notifications', async ({ assert }) => {
    const user = await UserFactory.create()
    const other = await UserFactory.create()
    const realtime = new RealtimeService()

    assert.isTrue(realtime.canSubscribeToUser(user, user.id))
    assert.isFalse(realtime.canSubscribeToUser(user, other.id))
    assert.isFalse(realtime.canSubscribeToUser(undefined, user.id))
  })

  test('seuls les membres des deux organisations peuvent s’abonner à un fil', async ({
    assert,
  }) => {
    const buyer = await OrganizationFactory.create()
    const supplier = await OrganizationFactory.apply('supplier').create()
    const buyerUser = await UserFactory.create()
    const outsider = await UserFactory.create()
    await joinOrganization(buyerUser, buyer, 'member')
    const conversation = await new ConversationService(new RealtimeService()).start({
      buyerOrganizationId: buyer.id,
      supplierOrganizationId: supplier.id,
      author: buyerUser,
      body: 'Ouverture',
    })
    const realtime = new RealtimeService()

    assert.isTrue(await realtime.canSubscribeToConversation(buyerUser, conversation.id))
    assert.isFalse(await realtime.canSubscribeToConversation(outsider, conversation.id))
    assert.isFalse(await realtime.canSubscribeToConversation(buyerUser, 999999))
    assert.isFalse(await realtime.canSubscribeToConversation(undefined, conversation.id))
  })

  test('unreadCount reflète les notifications existantes', async ({ assert }) => {
    const user = await UserFactory.create()
    await NotificationFactory.merge({ userId: user.id }).create()
    assert.equal(await new NotificationService(new RealtimeService()).unreadCount(user), 1)
  })
})
