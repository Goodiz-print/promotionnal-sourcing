import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { MessageSchema } from '#database/schema'
import Conversation from '#models/conversation'
import InboundMail from '#models/inbound_mail'
import MessageAttachment from '#models/message_attachment'
import User from '#models/user'
import type { ConversationSide } from '#shared/types/conversation'

/**
 * Message d'un fil de discussion. Écrit dans l'application (`authorUserId`) ou
 * né d'un mail entrant (`inboundMailId`, sans auteur : l'expéditeur est celui
 * du mail, #224).
 */
export default class Message extends MessageSchema {
  static table = 'messages'

  /** Côté qui a écrit (#226) : dit dans quel sens relayer le message. */
  declare senderSide: ConversationSide

  @belongsTo(() => Conversation)
  declare conversation: BelongsTo<typeof Conversation>

  @belongsTo(() => User, { foreignKey: 'authorUserId' })
  declare author: BelongsTo<typeof User>

  @belongsTo(() => InboundMail)
  declare inboundMail: BelongsTo<typeof InboundMail>

  @hasMany(() => MessageAttachment)
  declare attachments: HasMany<typeof MessageAttachment>
}
