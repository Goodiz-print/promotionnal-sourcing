import type MarkingTechnique from '#models/marking_technique'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import { resolveTranslation } from '#shared/helpers/translations'
import type { MarkingTechniqueAdminType } from '#shared/types/marking'

/**
 * Formate une technique de marquage pour la liste d'administration : nom
 * résolu dans la locale active, famille, nombre de produits (`$extras`).
 */
export default class MarkingTechniqueAdminTransformer extends BaseTransformer<MarkingTechnique> {
  constructor(
    resource: MarkingTechnique,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject(): MarkingTechniqueAdminType {
    // Déduit la langue source depuis les traductions (première is_auto = false)
    const sourceLocale = this.resource.translations.find((t) => !t.isAuto)?.locale ?? 'fr'

    const translation = resolveTranslation(this.resource.translations, this.locale, {
      sourceLocale,
    })

    return {
      id: this.resource.id,
      slug: this.resource.slug,
      name: translation?.name ?? null,
      family: this.resource.family,
      productsCount: Number(this.resource.$extras.products_count ?? 0),
    }
  }
}
