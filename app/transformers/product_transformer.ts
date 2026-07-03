import type Product from '#models/product'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class ProductTransformer extends BaseTransformer<Product> {
  toObject() {
    // `embedding` et `searchVector` ne sont jamais exposes au frontend.
    return this.pick(this.resource, [
      'id',
      'supplierId',
      'categoryId',
      'name',
      'slug',
      'reference',
      'description',
      'priceMin',
      'priceMax',
      'currency',
      'minQuantity',
      'imageUrl',
      'originCountry',
      'madeInEurope',
      'isActive',
      'createdAt',
      'updatedAt',
    ])
  }
}
