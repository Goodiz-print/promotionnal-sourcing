import type Attribute from '#models/attribute'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import { resolveTranslation } from '#shared/helpers/translations'
import type { AttributeType } from '#shared/types/attribute'

export default class AttributeTransformer extends BaseTransformer<Attribute> {
  constructor(
    resource: Attribute,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject(): AttributeType {
    const translation = resolveTranslation(this.resource.translations, this.locale, {
      sourceLocale: this.resource.sourceLocale,
    })

    return {
      ...this.pick(this.resource, ['id', 'slug', 'type', 'unit', 'isFilterable']),
      name: translation?.name ?? null,
      createdAt: this.resource.createdAt.toISO()!,
      updatedAt: this.resource.updatedAt?.toISO() ?? null,
    }
  }
}
