import type AttributeValue from '#models/attribute_value'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class AttributeValueTransformer extends BaseTransformer<AttributeValue> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'attributeId',
      'value',
      'label',
      'slug',
      'synonyms',
      'createdAt',
      'updatedAt',
    ])
  }
}
