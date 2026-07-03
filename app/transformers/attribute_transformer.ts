import type Attribute from '#models/attribute'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class AttributeTransformer extends BaseTransformer<Attribute> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'name',
      'slug',
      'type',
      'unit',
      'isFilterable',
      'createdAt',
      'updatedAt',
    ])
  }
}
