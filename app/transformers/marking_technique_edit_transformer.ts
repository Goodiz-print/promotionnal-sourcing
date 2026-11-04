import type MarkingTechnique from '#models/marking_technique'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { CONTENT_LOCALES, type ContentLocale } from '#shared/types/i18n'
import type { MarkingTechniqueEditType } from '#shared/types/marking'

/**
 * Formate une technique de marquage pour le formulaire d'édition : une entrée
 * de nom par langue de contenu (chaîne vide si absente), famille, synonymes.
 */
export default class MarkingTechniqueEditTransformer extends BaseTransformer<MarkingTechnique> {
  toObject(): MarkingTechniqueEditType {
    const translations = {} as MarkingTechniqueEditType['translations']

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
      family: this.resource.family,
      synonyms: this.resource.synonyms ?? [],
      sourceLocale: this.resource.sourceLocale as ContentLocale,
      translations,
    }
  }
}
