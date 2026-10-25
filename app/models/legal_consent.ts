import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { LegalConsentSchema } from '#database/schema'
import Organization from '#models/organization'
import User from '#models/user'
import type { LegalConsentKind } from '#shared/types/legal'

/**
 * Ligne du journal des consentements et signatures électroniques (preuve juridique).
 */
export default class LegalConsent extends LegalConsentSchema {
  static table = 'legal_consents'

  declare kind: LegalConsentKind

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
