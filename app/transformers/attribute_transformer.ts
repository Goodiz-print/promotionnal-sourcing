import type Attribute from '#models/attribute'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import { resolveTranslation } from '#shared/helpers/translations'

export default class AttributeTransformer extends BaseTransformer<Attribute> {
  constructor(
    resource: Attribute,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject() {
    const translation = resolveTranslation(this.resource.translations, this.locale)

    return {
      ...this.pick(this.resource, [
        'id',
        'slug',
        'type',
        'unit',
        'isFilterable',
        'createdAt',
        'updatedAt',
      ]),
      name: translation?.name ?? null,
    }
  }
}
