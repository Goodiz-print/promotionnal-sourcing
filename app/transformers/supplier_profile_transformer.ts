import type SupplierProfile from '#models/supplier_profile'
import type { SupplierProfileType } from '#shared/types/organization'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class SupplierProfileTransformer extends BaseTransformer<SupplierProfile> {
  toObject(): SupplierProfileType {
    return {
      ...this.pick(this.resource, [
        'id',
        'organizationId',
        'minOrderQuantity',
        'deliveryDays',
        'deliveryScope',
        'certifications',
        'bio',
        'responseTimeDays',
        'companyType',
        'deliveryCountries',
        'spokenLanguages',
        'minOrderNote',
        'quoteEmail',
        'reportFrequency',
        'catalogueUpdateMode',
        'catalogueUpdateFrequency',
        'isFoundingPartner',
      ]),
      foundingPartnerUntil: this.resource.foundingPartnerUntil?.toISODate() ?? null,
      createdAt: this.resource.createdAt.toISO()!,
      updatedAt: this.resource.updatedAt?.toISO() ?? null,
    }
  }
}
