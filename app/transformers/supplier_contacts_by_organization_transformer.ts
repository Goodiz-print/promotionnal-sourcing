import { BaseTransformer } from '@adonisjs/core/transformers'
import type SupplierContact from '#models/supplier_contact'
import SupplierContactTransformer from '#transformers/supplier_contact_transformer'
import type { SupplierContactsByOrganization } from '#shared/types/supplier'

/**
 * Équipe commerciale visible, par organisation fournisseur (résultat de
 * `SupplierContactService.visibleForMany`) : prop `supplierContacts` du détail
 * d'une demande.
 */
export default class SupplierContactsByOrganizationTransformer extends BaseTransformer<
  Map<number, SupplierContact[]>
> {
  toObject(): SupplierContactsByOrganization {
    const result: SupplierContactsByOrganization = {}
    for (const [organizationId, contacts] of this.resource) {
      result[organizationId] = contacts.map((contact) =>
        new SupplierContactTransformer(contact).toObject()
      )
    }
    return result
  }
}
