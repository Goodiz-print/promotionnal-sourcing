import { belongsTo, afterSave } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import emitter from '@adonisjs/core/services/emitter'
import { ProductTranslationSchema } from '#database/schema'
import Product from '#models/product'
import ProductContentUpdated from '#events/product_content_updated'
import type { Locale } from '#shared/types/i18n'

export default class ProductTranslation extends ProductTranslationSchema {
  static table = 'product_translations'

  declare locale: Locale

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>

  /**
   * Creation ou mise a jour du texte traduit => le vecteur `products.embedding`
   * est perime, on redeclenche sa generation asynchrone (cf.
   * app/jobs/generate_product_embedding_job.ts).
   */
  @afterSave()
  static async emitContentUpdated(translation: ProductTranslation) {
    await emitter.emit(ProductContentUpdated, new ProductContentUpdated(translation.productId))
  }
}
