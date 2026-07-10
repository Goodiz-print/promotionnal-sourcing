import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { SupplierTranslationSchema } from '#database/schema'
import Supplier from '#models/supplier'
import type { Locale } from '#shared/types/i18n'

export default class SupplierTranslation extends SupplierTranslationSchema {
  static table = 'supplier_translations'

  declare locale: Locale

  @belongsTo(() => Supplier)
  declare supplier: BelongsTo<typeof Supplier>
}
