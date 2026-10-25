import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { CategoryAttributeSchema } from '#database/schema'
import Category from '#models/category'
import Attribute from '#models/attribute'
import CategoryAttributeRange from '#models/category_attribute_range'

/**
 * Pivot categorie ↔ attribut (ecart 1 du plan d'extension). Declare quels
 * attributs sont pertinents pour une categorie, s'ils sont obligatoires pour
 * publier, s'ils servent de filtre, et dans quel ordre. Un attribut peut etre
 * rattache a n'importe quel niveau (N1, N2 ou N3) ; `CatalogueFacetsService`
 * resout l'ensemble en remontant toute la chaine d'ancetres.
 */
export default class CategoryAttribute extends CategoryAttributeSchema {
  static table = 'category_attributes'

  @belongsTo(() => Category)
  declare category: BelongsTo<typeof Category>

  @belongsTo(() => Attribute)
  declare attribute: BelongsTo<typeof Attribute>

  @hasMany(() => CategoryAttributeRange)
  declare ranges: HasMany<typeof CategoryAttributeRange>
}
