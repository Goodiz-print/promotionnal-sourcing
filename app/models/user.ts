import { UserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Organization from '#models/organization'
import OrganizationUser from '#models/organization_user'
import Passkey from '#models/passkey'
import type { Civility } from '#shared/types/agency'
import type { PlatformRole } from '#shared/types/user'

export default class User extends compose(UserSchema, withAuthFinder(hash)) {
  declare platformRole: PlatformRole
  declare civility: Civility | null

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

  /**
   * Membre de l'équipe plateforme (back-office `/admin`), indépendamment de
   * son rôle dans une organisation.
   */
  get isPlatformAdmin(): boolean {
    return this.platformRole === 'admin'
  }

  /**
   * Porte un rôle plateforme (admin, modérateur, support ou analyste) : accès à
   * la porte d'entrée du back-office, pas forcément à toutes ses sections.
   */
  get hasBackOffice(): boolean {
    return this.platformRole !== 'none'
  }

  get initials() {
    if (this.firstName && this.lastName) {
      return `${this.firstName.charAt(0)}${this.lastName.charAt(0)}`.toUpperCase()
    }

    const [first] = this.fullName ? this.fullName.split(' ') : this.email.split('@')
    return `${first.slice(0, 2)}`.toUpperCase()
  }

  /**
   * Nom d'affichage (prénom + nom), ou `null` si aucun des deux n'est renseigné.
   */
  get fullName(): string | null {
    return [this.firstName, this.lastName].filter(Boolean).join(' ') || null
  }
}
