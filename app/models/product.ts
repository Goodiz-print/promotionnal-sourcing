import { belongsTo, hasMany, manyToMany, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import { ProductSchema } from '#database/schema'
import Supplier from '#models/supplier'
import Category from '#models/category'
import AttributeValue from '#models/attribute_value'
import ProductAttribute from '#models/product_attribute'
import ProductTranslation from '#models/product_translation'
import type { TranslationLocale } from '#shared/types/i18n'
import ProductImage from '#models/product_image'
import ProductVariant from '#models/product_variant'
import ProductPriceTier from '#models/product_price_tier'

export default class Product extends ProductSchema {
  static table = 'products'

  /** Langue dans laquelle le fournisseur a saisi le contenu (#75). */
  declare sourceLocale: TranslationLocale

  /**
   * Pendant de `Supplier.fromLiveOrganization` : masque les produits dont la
   * fiche fournisseur appartient à une organisation archivée.
   */
  static fromLiveOrganization = scope((query: ModelQueryBuilderContract<typeof Product>) => {
    query.whereHas('supplier', (supplier) =>
      supplier.whereDoesntHave('organization', (organization) =>
        organization.whereNotNull('archivedAt')
      )
    )
  })

  @hasMany(() => ProductTranslation)
  declare translations: HasMany<typeof ProductTranslation>

  @hasMany(() => ProductImage)
  declare images: HasMany<typeof ProductImage>

  @hasMany(() => ProductVariant)
  declare variants: HasMany<typeof ProductVariant>

  @hasMany(() => ProductPriceTier)
  declare priceTiers: HasMany<typeof ProductPriceTier>

  @belongsTo(() => Supplier)
  declare supplier: BelongsTo<typeof Supplier>

  @belongsTo(() => Category)
  declare category: BelongsTo<typeof Category>

  @hasMany(() => ProductAttribute)
  declare productAttributes: HasMany<typeof ProductAttribute>

  @manyToMany(() => AttributeValue, {
    pivotTable: 'product_attributes',
    pivotColumns: ['attribute_id', 'value_number', 'value_string'],
    pivotTimestamps: false,
  })
  declare attributeValues: ManyToMany<typeof AttributeValue>
}
