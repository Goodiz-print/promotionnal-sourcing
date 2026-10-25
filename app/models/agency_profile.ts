import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { AgencyProfileSchema } from '#database/schema'
import Organization from '#models/organization'
import type {
  AgencyActivity,
  AgencyClientSector,
  AgencyPurchaseVolume,
  AgencyTeamSize,
} from '#shared/types/agency'

/**
 * Profil d'une organisation acheteur de type agence (activité déclarée,
 * qualification du lead, marge par défaut des plaquettes).
 */
export default class AgencyProfile extends AgencyProfileSchema {
  static table = 'agency_profiles'

  declare activity: AgencyActivity
  declare teamSize: AgencyTeamSize | null
  declare purchaseVolume: AgencyPurchaseVolume | null
  declare clientSectors: AgencyClientSector[] | null

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>
}
