import factory from '@adonisjs/lucid/factories'
import Message from '#models/message'

/**
 * Message d'un fil. `conversationId` et `authorUserId` sont à fournir par l'appelant.
 */
export const MessageFactory = factory
  .define(Message, ({ faker }) => ({
    body: faker.lorem.paragraph(),
  }))
  .build()
