export type RoleSlug = 'owner' | 'admin' | 'manager' | 'member'

export interface RoleType {
  id: number
  name: string
  slug: RoleSlug
  description: string | null
}

export interface PermissionType {
  id: number
  name: string
  slug: string
  description: string | null
}

export interface RoleWithPermissionsType extends RoleType {
  permissions: PermissionType[]
}
