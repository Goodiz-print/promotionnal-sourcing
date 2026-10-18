import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { ConversationReadSchema } from '#database/schema'
import Conversation from '#models/conversation'
import Message from '#models/message'
import User from '#models/user'

/**
 * Dernier message lu d'un fil, par participant (cf. migration).
 */
export default class ConversationRead extends ConversationReadSchema {
  static table = 'conversation_reads'

  @belongsTo(() => Conversation)
  declare conversation: BelongsTo<typeof Conversation>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Message, { foreignKey: 'lastReadMessageId' })
  declare lastReadMessage: BelongsTo<typeof Message>
}
