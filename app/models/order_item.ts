import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { OrderItemSchema } from '#database/schema'
import Order from '#models/order'
import Product from '#models/product'
import QuoteItem from '#models/quote_item'
import type { OrderCustomizationDetails } from '#shared/types/order'

/**
 * Ligne de commande, copiée d'une ligne de devis. Montants en `numeric`
 * (chaînes côté Lucid) : jamais recalculés ici.
 */
export default class OrderItem extends OrderItemSchema {
  static table = 'order_items'

  @column({
    prepare: (value: OrderCustomizationDetails | null) => (value ? JSON.stringify(value) : null),
    consume: (value: unknown): OrderCustomizationDetails | null => {
      if (value === null || value === undefined) return null
      return typeof value === 'string'
        ? (JSON.parse(value) as OrderCustomizationDetails)
        : (value as OrderCustomizationDetails)
    },
  })
  declare customizationDetails: OrderCustomizationDetails | null

  @belongsTo(() => Order)
  declare order: BelongsTo<typeof Order>

  @belongsTo(() => QuoteItem)
  declare quoteItem: BelongsTo<typeof QuoteItem>

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>
}
