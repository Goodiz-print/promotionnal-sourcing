import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { OrganizationInvitationSchema } from '#database/schema'
import Organization from '#models/organization'
import Role from '#models/role'
import User from '#models/user'
import type { InvitationStatus } from '#shared/types/organization'

export default class OrganizationInvitation extends OrganizationInvitationSchema {
  static table = 'organization_invitations'

  declare status: InvitationStatus

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>

  @belongsTo(() => Role)
  declare role: BelongsTo<typeof Role>

  @belongsTo(() => User, { foreignKey: 'invitedByUserId' })
  declare invitedBy: BelongsTo<typeof User>
}
