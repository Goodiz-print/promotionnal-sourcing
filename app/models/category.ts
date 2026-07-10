import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { CategorySchema } from '#database/schema'
import Product from '#models/product'
import CategoryTranslation from '#models/category_translation'

export default class Category extends CategorySchema {
  static table = 'categories'

  declare synonyms: string[]

  @hasMany(() => CategoryTranslation)
  declare translations: HasMany<typeof CategoryTranslation>

  @belongsTo(() => Category, { foreignKey: 'parentId' })
  declare parent: BelongsTo<typeof Category>

  @hasMany(() => Category, { foreignKey: 'parentId' })
  declare children: HasMany<typeof Category>

  @hasMany(() => Product)
  declare products: HasMany<typeof Product>
}
