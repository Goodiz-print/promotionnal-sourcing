import { belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import { CategorySchema } from '#database/schema'
import Product from '#models/product'
import Attribute from '#models/attribute'
import CategoryAttribute from '#models/category_attribute'
import CategoryTranslation from '#models/category_translation'
import type { TranslationLocale } from '#shared/types/i18n'

export default class Category extends CategorySchema {
  static table = 'categories'

  declare synonyms: string[]

  /** Langue dans laquelle le contenu de la catégorie est saisi (#75). */
  declare sourceLocale: TranslationLocale

  @hasMany(() => CategoryTranslation)
  declare translations: HasMany<typeof CategoryTranslation>

  @belongsTo(() => Category, { foreignKey: 'parentId' })
  declare parent: BelongsTo<typeof Category>

  @hasMany(() => Category, { foreignKey: 'parentId' })
  declare children: HasMany<typeof Category>

  @hasMany(() => Product)
  declare products: HasMany<typeof Product>

  /**
   * Attributs pertinents pour cette categorie (ecart 1). Le pivot porte
   * `is_required_for_publication`, `is_filter` et `position`. La resolution
   * complete (attributs propres + herites des ancetres) passe par
   * `CatalogueFacetsService`.
   */
  @manyToMany(() => Attribute, {
    pivotTable: 'category_attributes',
    pivotColumns: ['is_required_for_publication', 'is_filter', 'position'],
  })
  declare attributes: ManyToMany<typeof Attribute>

  @hasMany(() => CategoryAttribute)
  declare categoryAttributes: HasMany<typeof CategoryAttribute>
}
