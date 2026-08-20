import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { RfqSchema } from '#database/schema'
import Organization from '#models/organization'
import RfqItem from '#models/rfq_item'
import RfqSupplier from '#models/rfq_supplier'
import User from '#models/user'
import type { RfqStatus } from '#shared/types/rfq'

/**
 * Demande de devis émise par une organisation acheteuse. Le détail du besoin
 * vit dans `items`, la liste des destinataires dans `suppliers` (avec un
 * statut par fournisseur) — cf. `RfqService` pour les transitions.
 */
export default class Rfq extends RfqSchema {
  static table = 'rfqs'

  declare status: RfqStatus

  @belongsTo(() => Organization, { foreignKey: 'buyerOrganizationId' })
  declare buyerOrganization: BelongsTo<typeof Organization>

  @belongsTo(() => User, { foreignKey: 'createdByUserId' })
  declare createdBy: BelongsTo<typeof User>

  @hasMany(() => RfqItem)
  declare items: HasMany<typeof RfqItem>

  @hasMany(() => RfqSupplier)
  declare suppliers: HasMany<typeof RfqSupplier>
}
