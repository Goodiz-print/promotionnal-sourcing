import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { NotificationSchema } from '#database/schema'
import User from '#models/user'
import type { NotificationData, NotificationType } from '#shared/types/notification'

/**
 * Notification in-app destinée à un utilisateur. Lue ou non selon `readAt`.
 */
export default class Notification extends NotificationSchema {
  static table = 'notifications'

  declare type: NotificationType
  declare data: NotificationData

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
