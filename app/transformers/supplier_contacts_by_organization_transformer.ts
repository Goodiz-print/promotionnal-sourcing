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
    return Object.fromEntries(
      [...this.resource].map(([organizationId, contacts]) => [
        organizationId,
        contacts.map((contact) => new SupplierContactTransformer(contact).toObject()),
      ])
    )
  }
}
