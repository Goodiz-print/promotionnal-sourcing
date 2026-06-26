import { hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import { RoleSchema } from '#database/schema'
import Permission from '#models/permission'
import OrganizationUser from '#models/organization_user'

export default class Role extends RoleSchema {
  static table = 'roles'

  @manyToMany(() => Permission, {
    pivotTable: 'role_permissions',
    pivotTimestamps: false,
  })
  declare permissions: ManyToMany<typeof Permission>

  @hasMany(() => OrganizationUser)
  declare organizationUsers: HasMany<typeof OrganizationUser>
}
