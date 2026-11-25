import factory from '@adonisjs/lucid/factories'
import Message from '#models/message'

/**
 * Message d'un fil. `conversationId` et `authorUserId` sont à fournir par
 * l'appelant ; `senderSide` vaut `supplier` sauf état `fromAgency` (#226).
 */
export const MessageFactory = factory
  .define(Message, ({ faker }) => ({
    body: faker.lorem.paragraph(),
    senderSide: 'supplier' as const,
  }))
  .state('fromAgency', (message) => {
    message.senderSide = 'agency'
  })
  .build()
