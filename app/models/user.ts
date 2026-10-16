import { UserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Organization from '#models/organization'
import OrganizationUser from '#models/organization_user'
import Passkey from '#models/passkey'

export default class User extends compose(UserSchema, withAuthFinder(hash)) {
  @belongsTo(() => Organization, {
    foreignKey: 'currentOrganizationId',
  })
  declare currentOrganization: BelongsTo<typeof Organization>

  @hasMany(() => OrganizationUser)
  declare organizationUsers: HasMany<typeof OrganizationUser>

  @hasMany(() => Passkey)
  declare passkeys: HasMany<typeof Passkey>

  @manyToMany(() => Organization, {
    pivotTable: 'organization_users',
    pivotColumns: ['role_id', 'joined_at'],
    pivotTimestamps: false,
  })
  declare organizations: ManyToMany<typeof Organization>

  get initials() {
    const [first, last] = this.fullName ? this.fullName.split(' ') : this.email.split('@')
    if (first && last) {
      return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
    }

    return `${first.slice(0, 2)}`.toUpperCase()
  }
}
