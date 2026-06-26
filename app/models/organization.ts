import { hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import { OrganizationSchema } from '#database/schema'
import OrganizationUser from '#models/organization_user'
import User from '#models/user'
import type { OrganizationSize } from '#shared/types/organization'

export default class Organization extends OrganizationSchema {
  static table = 'organizations'

  declare size: OrganizationSize | null

  @hasMany(() => OrganizationUser)
  declare organizationUsers: HasMany<typeof OrganizationUser>

  @manyToMany(() => User, {
    pivotTable: 'organization_users',
    pivotColumns: ['role_id', 'joined_at'],
    pivotTimestamps: false,
  })
  declare users: ManyToMany<typeof User>
}
