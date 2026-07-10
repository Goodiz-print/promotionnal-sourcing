import { hasMany, hasOne, manyToMany } from '@adonisjs/lucid/orm'
import type { HasMany, HasOne, ManyToMany } from '@adonisjs/lucid/types/relations'
import { OrganizationSchema } from '#database/schema'
import OrganizationUser from '#models/organization_user'
import Supplier from '#models/supplier'
import SupplierProfile from '#models/supplier_profile'
import User from '#models/user'
import type { OrganizationKind, OrganizationSize } from '#shared/types/organization'

export default class Organization extends OrganizationSchema {
  static table = 'organizations'

  declare size: OrganizationSize | null
  declare organizationType: OrganizationKind

  @hasMany(() => OrganizationUser)
  declare organizationUsers: HasMany<typeof OrganizationUser>

  @manyToMany(() => User, {
    pivotTable: 'organization_users',
    pivotColumns: ['role_id', 'joined_at'],
    pivotTimestamps: false,
  })
  declare users: ManyToMany<typeof User>

  @hasOne(() => SupplierProfile)
  declare supplierProfile: HasOne<typeof SupplierProfile>

  @hasMany(() => Supplier)
  declare suppliers: HasMany<typeof Supplier>
}
