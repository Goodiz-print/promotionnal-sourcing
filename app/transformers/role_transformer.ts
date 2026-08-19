import type Role from '#models/role'
import type { RoleSlug, RoleType } from '#shared/types/role'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class RoleTransformer extends BaseTransformer<Role> {
  toObject(): RoleType {
    return {
      ...this.pick(this.resource, ['id', 'name', 'description']),
      slug: this.resource.slug as RoleSlug,
    }
  }
}
