import type Category from '#models/category'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import { resolveTranslation } from '#shared/helpers/translations'

export default class CategoryTransformer extends BaseTransformer<Category> {
  constructor(
    resource: Category,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject() {
    const translation = resolveTranslation(this.resource.translations, this.locale)

    return {
      ...this.pick(this.resource, ['id', 'slug', 'parentId', 'synonyms', 'createdAt', 'updatedAt']),
      name: translation?.name ?? null,
      description: translation?.description ?? null,
    }
  }
}
