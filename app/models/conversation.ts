import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { ConversationSchema } from '#database/schema'
import Message from '#models/message'
import Organization from '#models/organization'
import Rfq from '#models/rfq'
import RfqSupplier from '#models/rfq_supplier'
import User from '#models/user'

/**
 * Fil de discussion entre une organisation acheteuse et une organisation
 * fournisseur. Les messages sont dans `messages`. `rfqSupplierId` désigne le fil
 * d'une demande pour un destinataire : les réponses reçues par mail y arrivent
 * (#224).
 */
export default class Conversation extends ConversationSchema {
  static table = 'conversations'

  @belongsTo(() => Organization, { foreignKey: 'buyerOrganizationId' })
  declare buyerOrganization: BelongsTo<typeof Organization>

  @belongsTo(() => Organization, { foreignKey: 'supplierOrganizationId' })
  declare supplierOrganization: BelongsTo<typeof Organization>

  @belongsTo(() => Rfq)
  declare rfq: BelongsTo<typeof Rfq>

  @belongsTo(() => RfqSupplier)
  declare rfqSupplier: BelongsTo<typeof RfqSupplier>

  @belongsTo(() => User, { foreignKey: 'createdByUserId' })
  declare createdBy: BelongsTo<typeof User>

  @hasMany(() => Message)
  declare messages: HasMany<typeof Message>
}
