import type Attribute from '#models/attribute'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { CONTENT_LOCALES, type ContentLocale } from '#shared/types/i18n'
import type { AttributeDataType, AttributeEditType } from '#shared/types/attribute'

/**
 * Formate une facette pour le formulaire d'édition : une entrée de nom par
 * langue de contenu (chaîne vide si absente) et ses valeurs, dont seul le
 * libellé de la langue source est exposé pour l'édition en ligne.
 */
export default class AttributeEditTransformer extends BaseTransformer<Attribute> {
  toObject(): AttributeEditType {
    const translations = {} as AttributeEditType['translations']
    for (const locale of CONTENT_LOCALES) {
      const translation = this.resource.translations.find((row) => row.locale === locale)
      translations[locale] = {
        name: translation?.name ?? '',
        isAuto: translation?.isAuto ?? false,
      }
    }

    return {
      id: this.resource.id,
      slug: this.resource.slug,
      type: this.resource.type as AttributeDataType,
      unit: this.resource.unit,
      isFilterable: this.resource.isFilterable,
      sourceLocale: this.resource.sourceLocale as ContentLocale,
      translations,
      values: this.resource.values.map((value) => ({
        id: value.id,
        slug: value.slug,
        sourceLocale: value.sourceLocale as ContentLocale,
        label: value.translations.find((row) => row.locale === value.sourceLocale)?.label ?? '',
        synonyms: value.synonyms ?? [],
        productsCount: Number(value.$extras.products_count ?? 0),
      })),
    }
  }
}
