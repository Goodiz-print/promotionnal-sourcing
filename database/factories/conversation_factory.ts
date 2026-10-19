import factory from '@adonisjs/lucid/factories'
import Conversation from '#models/conversation'

/**
 * Fil de discussion. Les deux organisations sont à fournir par l'appelant
 * (`.merge({ buyerOrganizationId, supplierOrganizationId })`).
 */
export const ConversationFactory = factory
  .define(Conversation, ({ faker }) => ({
    subject: faker.lorem.sentence({ min: 2, max: 5 }),
    rfqId: null,
    createdByUserId: null,
  }))
  .build()
