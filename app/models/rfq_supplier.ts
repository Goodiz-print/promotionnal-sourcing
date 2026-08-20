import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { RfqSupplierSchema } from '#database/schema'
import Organization from '#models/organization'
import Rfq from '#models/rfq'
import type { RfqSupplierStatus } from '#shared/types/rfq'

/**
 * Destinataire d'une RFQ : une organisation fournisseur, avec l'avancement de
 * la demande *pour elle* (`pending` → `sent` → `viewed` → `responded`).
 */
export default class RfqSupplier extends RfqSupplierSchema {
  static table = 'rfq_suppliers'

  declare status: RfqSupplierStatus

  @belongsTo(() => Rfq)
  declare rfq: BelongsTo<typeof Rfq>

  @belongsTo(() => Organization, { foreignKey: 'supplierOrganizationId' })
  declare supplierOrganization: BelongsTo<typeof Organization>
}
