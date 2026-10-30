import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { ProductTranslationSchema } from '#database/schema'
import Product from '#models/product'
import type { ContentLocale } from '#shared/types/i18n'

export default class ProductTranslation extends ProductTranslationSchema {
  static table = 'product_translations'

  declare locale: ContentLocale

  /** Mots-clés et arguments marketing par locale (écart 5). */
  declare keywords: string[] | null
  declare marketingPoints: string[] | null

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>
}
