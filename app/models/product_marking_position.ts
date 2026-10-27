import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { ProductMarkingPositionSchema } from '#database/schema'
import Product from '#models/product'
import ProductDocument from '#models/product_document'
import ProductMarkingPositionTechnique from '#models/product_marking_position_technique'

/**
 * Zone de marquage d'un produit (écart 2), 1..N par produit. Le gabarit pointe
 * un document du produit de type `marking_template` (`SET NULL` si le document
 * est supprimé).
 */
export default class ProductMarkingPosition extends ProductMarkingPositionSchema {
  static table = 'product_marking_positions'

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>

  @belongsTo(() => ProductDocument, { foreignKey: 'templateDocumentId' })
  declare templateDocument: BelongsTo<typeof ProductDocument>

  @hasMany(() => ProductMarkingPositionTechnique, { foreignKey: 'markingPositionId' })
  declare techniques: HasMany<typeof ProductMarkingPositionTechnique>
}
