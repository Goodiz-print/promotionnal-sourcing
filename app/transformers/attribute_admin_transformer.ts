import type Attribute from '#models/attribute'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import { resolveTranslation } from '#shared/helpers/translations'
import type { AttributeAdminType, AttributeDataType } from '#shared/types/attribute'

/**
 * Formate une facette pour la liste d'administration : nom résolu dans la locale
 * active, nombre de valeurs (`withCount`) et de produits (`$extras`).
 */
export default class AttributeAdminTransformer extends BaseTransformer<Attribute> {
  constructor(
    resource: Attribute,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject(): AttributeAdminType {
    const translation = resolveTranslation(this.resource.translations, this.locale, {
      sourceLocale: this.resource.sourceLocale,
    })

    return {
      id: this.resource.id,
      slug: this.resource.slug,
      name: translation?.name ?? null,
      type: this.resource.type as AttributeDataType,
      unit: this.resource.unit,
      isFilterable: this.resource.isFilterable,
      valuesCount: Number(this.resource.$extras.values_count ?? 0),
      productsCount: Number(this.resource.$extras.products_count ?? 0),
    }
  }
}
