import type Organization from '#models/organization'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class OrganizationTransformer extends BaseTransformer<Organization> {
  toObject() {
    return this.pick(this.resource, [
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
      'description',
      'logoUrl',
      'addressLine1',
      'addressLine2',
      'city',
      'postalCode',
      'country',
      'createdAt',
      'updatedAt',
    ])
  }
}
