import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { ModerationDecisionSchema } from '#database/schema'
import User from '#models/user'
import type { ModerationDecision, ModerationTargetType } from '#shared/types/moderation'

/**
 * Une décision de modération, ajoutée à l'historique. La cible n'est pas une
 * relation Lucid : elle est polymorphe (`targetType` + `targetId`).
 */
export default class ModerationDecisionRecord extends ModerationDecisionSchema {
  static table = 'moderation_decisions'

  declare targetType: ModerationTargetType
  declare status: ModerationDecision

  @belongsTo(() => User, { foreignKey: 'decidedByUserId' })
  declare decidedBy: BelongsTo<typeof User>
}
