export type RoleSlug = 'owner' | 'admin' | 'manager' | 'member'

/**
 * Déclarés en `type` (et non `interface`) pour rester assignables à
 * `Record<string, JSONDataTypes>` — contrainte de typage des props Inertia
 * (`inertia.render`), y compris quand ils sont nichés dans un autre DTO.
 */
export type RoleType = {
  id: number
  name: string
  slug: RoleSlug
  description: string | null
}

export type PermissionType = {
  id: number
  name: string
  slug: string
  description: string | null
}

export type RoleWithPermissionsType = RoleType & {
  permissions: PermissionType[]
}
