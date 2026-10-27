import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { ProductMarkingPositionTechniqueSchema } from '#database/schema'
import MarkingTechnique from '#models/marking_technique'
import ProductMarkingPosition from '#models/product_marking_position'

/**
 * Technique possible sur une position de marquage (écart 2) : nombre de couleurs
 * max et frais techniques (setup). `defaultSetupCharge` est un décimal (string
 * en base, comme les autres colonnes decimal du projet).
 */
export default class ProductMarkingPositionTechnique extends ProductMarkingPositionTechniqueSchema {
  static table = 'product_marking_position_techniques'

  @belongsTo(() => ProductMarkingPosition, { foreignKey: 'markingPositionId' })
  declare markingPosition: BelongsTo<typeof ProductMarkingPosition>

  @belongsTo(() => MarkingTechnique)
  declare technique: BelongsTo<typeof MarkingTechnique>
}
