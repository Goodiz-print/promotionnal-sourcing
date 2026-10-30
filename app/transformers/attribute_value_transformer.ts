import type AttributeValue from '#models/attribute_value'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import { resolveTranslation } from '#shared/helpers/translations'
import type { AttributeValueType } from '#shared/types/attribute'

export default class AttributeValueTransformer extends BaseTransformer<AttributeValue> {
  constructor(
    resource: AttributeValue,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject(): AttributeValueType {
    const translation = resolveTranslation(this.resource.translations, this.locale, {
      sourceLocale: this.resource.sourceLocale,
    })

    return {
      ...this.pick(this.resource, ['id', 'attributeId', 'value', 'slug', 'synonyms']),
      label: translation?.label ?? null,
      hex: this.resource.hex,
      parentValueId: this.resource.parentValueId,
      createdAt: this.resource.createdAt.toISO()!,
      updatedAt: this.resource.updatedAt?.toISO() ?? null,
    }
  }
}
