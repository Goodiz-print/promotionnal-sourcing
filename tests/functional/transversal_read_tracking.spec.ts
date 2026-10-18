import { test } from '@japa/runner'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import ConversationService from '#services/conversation_service'
import RealtimeService from '#services/realtime_service'
import { joinOrganization } from '#tests/utils/organizations'
import { ConversationAccessDeniedException } from '#exceptions/messaging_errors'
import { useDatabase } from '#tests/utils/setup'

test.group('Suivi de lecture des messages', (group) => {
  useDatabase(group)

  async function fixtures() {
    const buyer = await OrganizationFactory.create()
    const supplier = await OrganizationFactory.apply('supplier').create()
    const buyerUser = await UserFactory.create()
    const supplierUser = await UserFactory.create()
    await joinOrganization(buyerUser, buyer, 'member')
    await joinOrganization(supplierUser, supplier, 'member')
    const service = new ConversationService(new RealtimeService())
    const conversation = await service.start({
      buyerOrganizationId: buyer.id,
      supplierOrganizationId: supplier.id,
      author: buyerUser,
      body: 'Question',
    })
    return { service, conversation, buyerUser, supplierUser }
  }

  test('les messages d’autrui sont non lus jusqu’à la lecture', async ({ assert }) => {
    const { service, conversation, buyerUser, supplierUser } = await fixtures()
    await service.post(conversation, supplierUser, 'Réponse 1')
    await service.post(conversation, supplierUser, 'Réponse 2')

    assert.equal(await service.unreadCount(conversation, buyerUser), 2)
  })

  test('markRead remet le compteur à zéro, et reste idempotent', async ({ assert }) => {
    const { service, conversation, buyerUser, supplierUser } = await fixtures()
    await service.post(conversation, supplierUser, 'Réponse')

    assert.equal(await service.unreadCount(conversation, buyerUser), 1)
    await service.markRead(conversation, buyerUser)
    await service.markRead(conversation, buyerUser)

    assert.equal(await service.unreadCount(conversation, buyerUser), 0)
  })

  test('les nouveaux messages après une lecture sont à nouveau non lus', async ({ assert }) => {
    const { service, conversation, buyerUser, supplierUser } = await fixtures()
    await service.markRead(conversation, buyerUser)
    await service.post(conversation, supplierUser, 'Nouveau')

    assert.equal(await service.unreadCount(conversation, buyerUser), 1)
  })

  test('ses propres messages ne sont jamais non lus pour lui', async ({ assert }) => {
    const { service, conversation, buyerUser } = await fixtures()
    await service.post(conversation, buyerUser, 'Relance')

    assert.equal(await service.unreadCount(conversation, buyerUser), 0)
  })

  test('la lecture est propre à chaque participant', async ({ assert }) => {
    const { service, conversation, buyerUser, supplierUser } = await fixtures()
    await service.post(conversation, buyerUser, 'Relance')
    await service.markRead(conversation, supplierUser)

    assert.equal(await service.unreadCount(conversation, supplierUser), 0)
    assert.equal(await service.unreadCount(conversation, buyerUser), 0)
  })

  test('un tiers ne peut ni marquer lu ni compter pour un fil', async ({ assert }) => {
    const { service, conversation } = await fixtures()
    const outsider = await UserFactory.create()

    await assert.rejects(
      () => service.markRead(conversation, outsider),
      ConversationAccessDeniedException
    )
    await assert.rejects(
      () => service.unreadCount(conversation, outsider),
      ConversationAccessDeniedException
    )
  })
})
