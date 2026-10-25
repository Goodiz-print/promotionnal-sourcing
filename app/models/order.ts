import { belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { OrderSchema } from '#database/schema'
import Organization from '#models/organization'
import OrderItem from '#models/order_item'
import Quote from '#models/quote'
import type { OrderAddress, OrderStatus } from '#shared/types/order'

/** `jsonb` est rendu en objet par Postgres, en texte par SQLite : on normalise. */
function consumeAddress(value: unknown): OrderAddress | null {
  if (value === null || value === undefined) return null
  return typeof value === 'string' ? (JSON.parse(value) as OrderAddress) : (value as OrderAddress)
}

function prepareAddress(value: OrderAddress | null): string | null {
  return value ? JSON.stringify(value) : null
}

/**
 * Commande née de l'acceptation d'un devis. Les transitions de statut vivent
 * dans `OrderService`.
 */
export default class Order extends OrderSchema {
  static table = 'orders'

  declare status: OrderStatus

  @column({ prepare: prepareAddress, consume: consumeAddress })
  declare shippingAddress: OrderAddress | null

  @column({ prepare: prepareAddress, consume: consumeAddress })
  declare billingAddress: OrderAddress | null

  @belongsTo(() => Quote)
  declare quote: BelongsTo<typeof Quote>

  @belongsTo(() => Organization, { foreignKey: 'buyerOrganizationId' })
  declare buyerOrganization: BelongsTo<typeof Organization>

  @belongsTo(() => Organization, { foreignKey: 'supplierOrganizationId' })
  declare supplierOrganization: BelongsTo<typeof Organization>

  @hasMany(() => OrderItem)
  declare items: HasMany<typeof OrderItem>
}
