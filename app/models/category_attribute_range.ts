import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { CategoryAttributeRangeSchema } from '#database/schema'
import CategoryAttribute from '#models/category_attribute'

/**
 * Tranche de filtre d'un attribut numerique rattache a une categorie (ex.
 * contenance « 400-600 ml »). Les bornes sont stockees, pas le libelle : il est
 * rendu cote UI depuis `minValue`/`maxValue`, l'unite de l'attribut et la locale.
 * Une borne `null` est ouverte (`< 400` : minValue null ; `> 900` : maxValue null).
 */
export default class CategoryAttributeRange extends CategoryAttributeRangeSchema {
  static table = 'category_attribute_ranges'

  @belongsTo(() => CategoryAttribute)
  declare categoryAttribute: BelongsTo<typeof CategoryAttribute>
}
