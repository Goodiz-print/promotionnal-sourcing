import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Role from '#models/role'
import Permission from '#models/permission'

const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: [
    'organization:manage',
    'members:invite',
    'members:manage',
    'roles:assign',
    'sourcing:create',
    'sourcing:manage',
    'sourcing:view',
    'billing:manage',
  ],
  admin: [
    'organization:manage',
    'members:invite',
    'members:manage',
    'roles:assign',
    'sourcing:create',
    'sourcing:manage',
    'sourcing:view',
  ],
  manager: ['members:invite', 'sourcing:create', 'sourcing:manage', 'sourcing:view'],
  member: ['sourcing:create', 'sourcing:view'],
}

export default class RolePermissionSeeder extends BaseSeeder {
  async run() {
    const roles = await Role.query().select('id', 'slug')
    const permissions = await Permission.query().select('id', 'slug')
    const permissionBySlug = new Map(permissions.map((p) => [p.slug, p.id]))

    for (const role of roles) {
      const permSlugs = ROLE_PERMISSIONS[role.slug] ?? []
      const permissionIds = permSlugs
        .map((slug) => permissionBySlug.get(slug))
        .filter((id): id is number => id !== undefined)
      await role.related('permissions').sync(permissionIds)
    }
  }
}
