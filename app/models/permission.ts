import { manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import { PermissionSchema } from '#database/schema'
import Role from '#models/role'

export default class Permission extends PermissionSchema {
  static table = 'permissions'

  @manyToMany(() => Role, {
    pivotTable: 'role_permissions',
    pivotTimestamps: false,
  })
  declare roles: ManyToMany<typeof Role>
}
