import { test } from '@japa/runner'
import RealtimeService from '#services/realtime_service'
import { ConversationFactory } from '#database/factories/conversation_factory'
import Conversation from '#models/conversation'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { RfqFactory } from '#database/factories/rfq_factory'
import { UserFactory } from '#database/factories/user_factory'
import ConversationService from '#services/conversation_service'
import { joinOrganization } from '#tests/utils/organizations'
import {
  ConversationAccessDeniedException,
  InvalidMessageBodyException,
} from '#exceptions/messaging_errors'
import { MESSAGE_MAX_LENGTH } from '#shared/types/conversation'
import { useDatabase } from '#tests/utils/setup'

test.group('Messagerie acheteur ↔ fournisseur', (group) => {
  useDatabase(group)

  async function fixtures() {
    const buyer = await OrganizationFactory.create()
    const supplier = await OrganizationFactory.apply('supplier').create()
    const buyerUser = await UserFactory.create()
    const supplierUser = await UserFactory.create()
    await joinOrganization(buyerUser, buyer, 'member')
    await joinOrganization(supplierUser, supplier, 'member')
    return { buyer, supplier, buyerUser, supplierUser }
  }

  test('start ouvre le fil et écrit le premier message dans la même transaction', async ({
    assert,
  }) => {
    const { buyer, supplier, buyerUser } = await fixtures()
    const service = new ConversationService(new RealtimeService())

    const conversation = await service.start({
      buyerOrganizationId: buyer.id,
      supplierOrganizationId: supplier.id,
      author: buyerUser,
      body: '  Bonjour, avez-vous des stocks ?  ',
    })
    const messages = await service.messagesOf(conversation)

    assert.equal(conversation.createdByUserId, buyerUser.id)
    assert.lengthOf(messages, 1)
    assert.equal(messages[0].body, 'Bonjour, avez-vous des stocks ?')
  })

  test('un membre de l’autre organisation peut répondre, un tiers ne peut pas', async ({
    assert,
  }) => {
    const { buyer, supplier, buyerUser, supplierUser } = await fixtures()
    const outsider = await UserFactory.create()
    const service = new ConversationService(new RealtimeService())
    const conversation = await service.start({
      buyerOrganizationId: buyer.id,
      supplierOrganizationId: supplier.id,
      author: buyerUser,
      body: 'Question',
    })

    await service.post(conversation, supplierUser, 'Réponse')
    await assert.rejects(
      () => service.post(conversation, outsider, 'Intrus'),
      ConversationAccessDeniedException
    )
    assert.lengthOf(await service.messagesOf(conversation), 2)
  })

  test('start refuse un auteur qui n’appartient à aucune des deux organisations', async ({
    assert,
  }) => {
    const { buyer, supplier } = await fixtures()
    const outsider = await UserFactory.create()

    await assert.rejects(
      () =>
        new ConversationService(new RealtimeService()).start({
          buyerOrganizationId: buyer.id,
          supplierOrganizationId: supplier.id,
          author: outsider,
          body: 'Hors sujet',
        }),
      ConversationAccessDeniedException
    )
  })

  test('un corps vide ou trop long est refusé', async ({ assert }) => {
    const { buyer, supplier, buyerUser } = await fixtures()
    const service = new ConversationService(new RealtimeService())
    const conversation = await service.start({
      buyerOrganizationId: buyer.id,
      supplierOrganizationId: supplier.id,
      author: buyerUser,
      body: 'Ouverture',
    })

    await assert.rejects(
      () => service.post(conversation, buyerUser, '   '),
      InvalidMessageBodyException
    )
    await assert.rejects(
      () => service.post(conversation, buyerUser, 'a'.repeat(MESSAGE_MAX_LENGTH + 1)),
      InvalidMessageBodyException
    )
  })

  test('un fil peut être rattaché à une RFQ, et la RFQ peut disparaître sans le supprimer', async ({
    assert,
  }) => {
    const { buyer, supplier, buyerUser } = await fixtures()
    const rfq = await RfqFactory.merge({ buyerOrganizationId: buyer.id }).create()
    const conversation = await new ConversationService(new RealtimeService()).start({
      buyerOrganizationId: buyer.id,
      supplierOrganizationId: supplier.id,
      author: buyerUser,
      body: 'Au sujet de la demande',
      rfqId: rfq.id,
    })

    await rfq.delete()
    await conversation.refresh()

    assert.isNull(conversation.rfqId)
  })

  test('un fil est supprimé avec son organisation', async ({ assert }) => {
    const { buyer, supplier } = await fixtures()
    const conversation = await ConversationFactory.merge({
      buyerOrganizationId: buyer.id,
      supplierOrganizationId: supplier.id,
    }).create()

    await supplier.delete()

    assert.isNull(await Conversation.find(conversation.id))
  })
})
