import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { MessageSchema } from '#database/schema'
import Conversation from '#models/conversation'
import User from '#models/user'

/**
 * Message d'un fil de discussion.
 */
export default class Message extends MessageSchema {
  static table = 'messages'

  @belongsTo(() => Conversation)
  declare conversation: BelongsTo<typeof Conversation>

  @belongsTo(() => User, { foreignKey: 'authorUserId' })
  declare author: BelongsTo<typeof User>
}
