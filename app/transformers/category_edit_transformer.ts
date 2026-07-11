import type Category from '#models/category'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { SUPPORTED_LOCALES } from '#shared/types/i18n'
import type { CategoryEditType } from '#shared/types/category'

/**
 * Formate une catégorie pour le formulaire d'édition : les deux traductions
 * (une entrée par locale, chaînes vides si absentes) + slug/parent/synonymes.
 */
export default class CategoryEditTransformer extends BaseTransformer<Category> {
  toObject(): CategoryEditType {
    const translations = {} as CategoryEditType['translations']
    for (const locale of SUPPORTED_LOCALES) {
      const translation = this.resource.translations.find((row) => row.locale === locale)
      translations[locale] = {
        name: translation?.name ?? '',
        description: translation?.description ?? null,
      }
    }

    return {
      id: this.resource.id,
      slug: this.resource.slug,
      parentId: this.resource.parentId,
      synonyms: this.resource.synonyms ?? [],
      translations,
    }
  }
}
