import { inject } from '@adonisjs/core'
import MessageRelayService from '#services/message_relay_service'
import type ConversationMessageRecorded from '#events/conversation_message_recorded'

/**
 * Un message du fil d'une demande est à relayer (#226) : le service l'envoie
 * par mail à l'autre côté. Les échecs sont loggués par le service sans être
 * propagés : le message est enregistré et visible dans le fil.
 */
@inject()
export default class OnConversationMessageRecorded {
  constructor(private relay: MessageRelayService) {}

  async handle({ message }: ConversationMessageRecorded) {
    await this.relay.relay(message)
  }
}
