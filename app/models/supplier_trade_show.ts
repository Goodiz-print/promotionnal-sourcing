import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { SupplierTradeShowSchema } from '#database/schema'
import Organization from '#models/organization'

/**
 * Salon où un fournisseur est présent (année, stand).
 */
export default class SupplierTradeShow extends SupplierTradeShowSchema {
  static table = 'supplier_trade_shows'

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>
}
