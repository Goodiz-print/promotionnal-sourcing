import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { ProductMarkingPriceTierSchema } from '#database/schema'
import MarkingTechnique from '#models/marking_technique'
import Product from '#models/product'

/**
 * Palier de la grille de prix de marquage (écart 2) : à partir de `minQuantity`
 * pièces, le marquage dans cette technique coûte `unitPrice` par pièce. Patron
 * identique à `product_price_tiers`, indexé par technique. `unitPrice` est un
 * décimal (string en base).
 */
export default class ProductMarkingPriceTier extends ProductMarkingPriceTierSchema {
  static table = 'product_marking_price_tiers'

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>

  @belongsTo(() => MarkingTechnique)
  declare technique: BelongsTo<typeof MarkingTechnique>
}
