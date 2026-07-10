import type AttributeValue from '#models/attribute_value'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import { resolveTranslation } from '#shared/helpers/translations'

export default class AttributeValueTransformer extends BaseTransformer<AttributeValue> {
  constructor(
    resource: AttributeValue,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject() {
    const translation = resolveTranslation(this.resource.translations, this.locale)

    return {
      ...this.pick(this.resource, [
        'id',
        'attributeId',
        'value',
        'slug',
        'synonyms',
        'createdAt',
        'updatedAt',
      ]),
      label: translation?.label ?? null,
    }
  }
}
