import type Category from '#models/category'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import { resolveTranslation } from '#shared/helpers/translations'
import type { CategoryType } from '#shared/types/category'

export default class CategoryTransformer extends BaseTransformer<Category> {
  constructor(
    resource: Category,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject(): CategoryType {
    const translation = resolveTranslation(
      this.resource.translations,
      this.locale,
      this.resource.sourceLocale
    )

    return {
      ...this.pick(this.resource, ['id', 'slug', 'parentId', 'synonyms']),
      name: translation?.name ?? null,
      description: translation?.description ?? null,
      createdAt: this.resource.createdAt.toISO()!,
      updatedAt: this.resource.updatedAt?.toISO() ?? null,
    }
  }
}
