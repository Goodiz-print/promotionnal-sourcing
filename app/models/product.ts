import { belongsTo, hasMany, manyToMany, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import { ProductSchema } from '#database/schema'
import Supplier from '#models/supplier'
import Category from '#models/category'
import AttributeValue from '#models/attribute_value'
import ProductAttribute from '#models/product_attribute'
import ProductTranslation from '#models/product_translation'
import ProductImage from '#models/product_image'

export default class Product extends ProductSchema {
  static table = 'products'

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
