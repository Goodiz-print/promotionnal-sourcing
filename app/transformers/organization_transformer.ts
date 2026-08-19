import type Organization from '#models/organization'
import type { OrganizationType } from '#shared/types/organization'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class OrganizationTransformer extends BaseTransformer<Organization> {
  toObject(): OrganizationType {
    return {
      ...this.pick(this.resource, [
        'id',
        'name',
        'slug',
        'siret',
        'vatNumber',
        'email',
        'phone',
        'website',
        'industry',
        'size',
        'organizationType',
        'description',
        'logoUrl',
        'addressLine1',
        'addressLine2',
        'city',
        'postalCode',
        'country',
      ]),
      createdAt: this.resource.createdAt.toISO()!,
      updatedAt: this.resource.updatedAt?.toISO() ?? null,
    }
  }
}
