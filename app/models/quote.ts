import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { QuoteSchema } from '#database/schema'
import Organization from '#models/organization'
import QuoteItem from '#models/quote_item'
import Rfq from '#models/rfq'
import type { QuoteStatus } from '#shared/types/quote'

/**
 * Devis d'une organisation fournisseuse en réponse à une demande. Les
 * transitions (`draft → submitted → accepted | rejected | expired`) vivent dans
 * `QuoteService`.
 */
export default class Quote extends QuoteSchema {
  static table = 'quotes'

  declare status: QuoteStatus

  @belongsTo(() => Rfq)
  declare rfq: BelongsTo<typeof Rfq>

  @belongsTo(() => Organization, { foreignKey: 'supplierOrganizationId' })
  declare supplierOrganization: BelongsTo<typeof Organization>

  @hasMany(() => QuoteItem)
  declare items: HasMany<typeof QuoteItem>
}
