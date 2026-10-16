import type Category from '#models/category'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { CONTENT_LOCALES, type ContentLocale } from '#shared/types/i18n'
import type { CategoryEditType } from '#shared/types/category'

/**
 * Formate une catégorie pour le formulaire d'édition : les traductions
 * (une entrée par locale, chaînes vides si absentes) + slug/parent/synonymes.
 */
export default class CategoryEditTransformer extends BaseTransformer<Category> {
  toObject(): CategoryEditType {
    const translations = {} as CategoryEditType['translations']
    for (const locale of CONTENT_LOCALES) {
      const translation = this.resource.translations.find((row) => row.locale === locale)
      translations[locale] = {
        name: translation?.name ?? '',
        description: translation?.description ?? null,
        isAuto: translation?.isAuto ?? false,
      }
    }

    return {
      id: this.resource.id,
      slug: this.resource.slug,
      parentId: this.resource.parentId,
      synonyms: this.resource.synonyms ?? [],
      sourceLocale: this.resource.sourceLocale as ContentLocale,
      translations,
    }
  }
}
