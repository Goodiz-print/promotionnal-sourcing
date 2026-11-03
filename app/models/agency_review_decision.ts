import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { AgencyReviewDecisionSchema } from '#database/schema'
import Organization from '#models/organization'
import User from '#models/user'
import type { AgencyReviewDecision } from '#shared/types/agency_review'
import type { AgencyReviewReason } from '#shared/types/agency_signup'

/**
 * Une décision de revue d'une inscription agence, ajoutée à l'historique (jamais
 * modifiée).
 */
export default class AgencyReviewDecisionRecord extends AgencyReviewDecisionSchema {
  static table = 'agency_review_decisions'

  declare decision: AgencyReviewDecision
  declare reviewReasons: AgencyReviewReason[]

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>

  @belongsTo(() => User, { foreignKey: 'decidedByUserId' })
  declare decidedBy: BelongsTo<typeof User>
}
