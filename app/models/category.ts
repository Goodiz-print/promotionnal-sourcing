import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { CategorySchema } from '#database/schema'
import Product from '#models/product'
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
}
