import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { ProductPackagingSchema } from '#database/schema'
import Product from '#models/product'

/**
 * Conditionnement / logistique produit (écart 3). Relation **1:1** avec
 * `products` (via `product_id` unique). `outerCartonVolumeM3` est un décimal :
 * Lucid le sérialise en chaîne (type `string`) comme les autres colonnes decimal
 * du projet — voir le cast généré dans `ProductPackagingSchema`.
 */
export default class ProductPackaging extends ProductPackagingSchema {
  static table = 'product_packagings'

  /**
   * Le snake_case par défaut de Lucid produit `outer_carton_volume_m_3` (un
   * underscore avant le chiffre) ≠ la colonne réelle `outer_carton_volume_m3` :
   * on fixe explicitement le `columnName` (le codegen n'émet pas ce cas, et
   * `schema.ts` ne doit pas être édité à la main).
   */
  @column({ columnName: 'outer_carton_volume_m3' })
  declare outerCartonVolumeM3: string | null

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>
}
