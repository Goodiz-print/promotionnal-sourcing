import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { RfqSupplierSchema } from '#database/schema'
import Organization from '#models/organization'
import Rfq from '#models/rfq'
import type { AwaitingReplyRfqSupplierStatus, RfqSupplierStatus } from '#shared/types/rfq'

/**
 * Destinataire d'une RFQ : une organisation fournisseur, avec l'avancement de
 * la demande *pour elle* (`pending` → `sent` → `viewed` → `responded`, ou `expired` à l'échéance).
 */
export default class RfqSupplier extends RfqSupplierSchema {
  static table = 'rfq_suppliers'

  declare status: RfqSupplierStatus

  /** Statut d'avant l'expiration (#232), rendu si l'échéance est prolongée. */
  declare expiredFrom: AwaitingReplyRfqSupplierStatus | null

  @belongsTo(() => Rfq)
  declare rfq: BelongsTo<typeof Rfq>

  @belongsTo(() => Organization, { foreignKey: 'supplierOrganizationId' })
  declare supplierOrganization: BelongsTo<typeof Organization>
}
