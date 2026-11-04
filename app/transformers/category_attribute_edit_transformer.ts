import type CategoryAttribute from '#models/category_attribute'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import { resolveTranslation } from '#shared/helpers/translations'
import type { AttributeDataType } from '#shared/types/attribute'
import type { CategoryAttributeEditType } from '#shared/types/category'

/**
 * Formate un pivot catégorie-attribut pour l'écran d'édition d'une catégorie :
 * les champs du pivot + le nom de l'attribut résolu + les plages.
 */
export default class CategoryAttributeEditTransformer extends BaseTransformer<CategoryAttribute> {
  constructor(
    resource: CategoryAttribute,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject(): CategoryAttributeEditType {
    const attribute = this.resource.attribute
    const translation = resolveTranslation(attribute.translations, this.locale, {
      sourceLocale: attribute.sourceLocale,
    })

    return {
      id: this.resource.id,
      attributeId: this.resource.attributeId,
      slug: attribute.slug,
      name: translation?.name ?? null,
      type: attribute.type as AttributeDataType,
      unit: attribute.unit,
      isRequiredForPublication: this.resource.isRequiredForPublication,
      isFilter: this.resource.isFilter,
      position: this.resource.position,
      ranges: (this.resource.ranges ?? []).map((range) => ({
        id: range.id,
        minValue: range.minValue === null ? null : Number(range.minValue),
        maxValue: range.maxValue === null ? null : Number(range.maxValue),
        position: range.position,
      })),
    }
  }
}
