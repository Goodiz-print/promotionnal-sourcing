import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import factory from '@adonisjs/lucid/factories'
import InboundMail from '#models/inbound_mail'

/**
 * Mail entrant tout juste journalisé par le webhook (`received`), pas encore
 * traité. `recipient` (l'adresse relais visée) reste à fournir par l'appelant.
 */
export const InboundMailFactory = factory
  .define(InboundMail, async ({ faker }) => ({
    provider: 'fake',
    providerMessageId: randomUUID(),
    senderAddress: faker.internet.email().toLowerCase(),
    subject: `Re: ${faker.commerce.productName()}`,
    status: 'received' as const,
    receivedAt: DateTime.now(),
  }))
  .build()
