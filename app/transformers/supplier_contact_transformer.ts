import { BaseTransformer } from '@adonisjs/core/transformers'
import type SupplierContact from '#models/supplier_contact'
import type { SupplierContactType } from '#shared/types/supplier'

/** Contact de l'équipe commerciale d'un fournisseur. */
export default class SupplierContactTransformer extends BaseTransformer<SupplierContact> {
  toObject(): SupplierContactType {
    return {
      ...this.pick(this.resource, [
        'id',
        'name',
        'jobTitle',
        'email',
        'phone',
        'languages',
        'countries',
        'position',
        'userId',
      ]),
    }
  }
}
