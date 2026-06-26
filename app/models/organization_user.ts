import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { OrganizationUserSchema } from '#database/schema'
import Organization from '#models/organization'
import User from '#models/user'
import Role from '#models/role'

export default class OrganizationUser extends OrganizationUserSchema {
  static table = 'organization_users'

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Role)
  declare role: BelongsTo<typeof Role>
}
