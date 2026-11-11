import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { QuoteCartItemSchema } from '#database/schema'
import Organization from '#models/organization'
import Product from '#models/product'
import User from '#models/user'

/**
 * Ligne du panier de devis d'un utilisateur, dans une organisation acheteuse.
 * Rien n'est envoyé tant que le panier n'est pas validé — cf. `QuoteCartService`.
 */
export default class QuoteCartItem extends QuoteCartItemSchema {
  static table = 'quote_cart_items'

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>
}
