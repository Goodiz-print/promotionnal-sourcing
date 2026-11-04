import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { MessageReportSchema } from '#database/schema'
import Message from '#models/message'
import User from '#models/user'

/**
 * Signalement d'un message par un participant du fil (#167).
 */
export default class MessageReport extends MessageReportSchema {
  static table = 'message_reports'

  @belongsTo(() => Message)
  declare message: BelongsTo<typeof Message>

  @belongsTo(() => User, { foreignKey: 'reporterUserId' })
  declare reporter: BelongsTo<typeof User>
}
