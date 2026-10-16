import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { ProductTranslationSchema } from '#database/schema'
import Product from '#models/product'
import type { TranslationLocale } from '#shared/types/i18n'

export default class ProductTranslation extends ProductTranslationSchema {
  static table = 'product_translations'

  declare locale: TranslationLocale

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>
}
