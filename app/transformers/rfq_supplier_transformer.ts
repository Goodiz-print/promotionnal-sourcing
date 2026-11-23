import { BaseTransformer } from '@adonisjs/core/transformers'
import type RfqSupplier from '#models/rfq_supplier'
import type { RfqSupplierType } from '#shared/types/rfq'

/**
 * Destinataire d'une demande, avec l'avancement le concernant — dont la
 * réponse tardive (#232), sans sa date. Suppose
 * `supplierOrganization` préchargé.
 */
export default class RfqSupplierTransformer extends BaseTransformer<RfqSupplier> {
  toObject(): RfqSupplierType {
    return {
      id: this.resource.id,
      supplierOrganizationId: this.resource.supplierOrganizationId,
      name: this.resource.supplierOrganization.name,
      slug: this.resource.supplierOrganization.slug,
      logoUrl: this.resource.supplierOrganization.logoUrl,
      status: this.resource.status,
      sentAt: this.resource.sentAt?.toISO() ?? null,
      lateReply: this.resource.lateReplyAt !== null,
    }
  }
}
