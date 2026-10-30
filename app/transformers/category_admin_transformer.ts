import type Category from '#models/category'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import { resolveTranslation } from '#shared/helpers/translations'
import type { CategoryAdminType } from '#shared/types/category'

/**
 * Formate une catégorie pour la liste d'administration : nom et nom du parent
 * résolus dans la locale active, + nombre de produits (via `withCount`).
 */
export default class CategoryAdminTransformer extends BaseTransformer<Category> {
  constructor(
    resource: Category,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject(): CategoryAdminType {
    const translation = resolveTranslation(this.resource.translations, this.locale, {
      sourceLocale: this.resource.sourceLocale,
    })
    const parent = this.resource.parent
    const parentTranslation = parent
      ? resolveTranslation(parent.translations, this.locale, {
          sourceLocale: parent.sourceLocale,
        })
      : null

    return {
      id: this.resource.id,
      slug: this.resource.slug,
      name: translation?.name ?? null,
      parentId: this.resource.parentId,
      parentName: parentTranslation?.name ?? null,
      productsCount: Number(this.resource.$extras.products_count ?? 0),
    }
  }
}
