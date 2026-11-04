import type MarkingTechnique from '#models/marking_technique'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { CONTENT_LOCALES, type ContentLocale } from '#shared/types/i18n'
import type { MarkingTechniqueEditType } from '#shared/types/marking'

/**
 * Formate une technique de marquage pour le formulaire d'édition : une entrée
 * de nom par langue de contenu (chaîne vide si absente), famille, synonymes.
 * La langue source est déduite des traductions (première is_auto = false).
 */
export default class MarkingTechniqueEditTransformer extends BaseTransformer<MarkingTechnique> {
  toObject(): MarkingTechniqueEditType {
    const translations = {} as MarkingTechniqueEditType['translations']
    let sourceLocale: ContentLocale = 'fr'

    for (const locale of CONTENT_LOCALES) {
      const translation = this.resource.translations.find((row) => row.locale === locale)
      translations[locale] = {
        name: translation?.name ?? '',
        isAuto: translation?.isAuto ?? false,
      }
      // La première traduction non automatique détermine la langue source
      if (translation && !translation.isAuto && sourceLocale === 'fr') {
        sourceLocale = locale
      }
    }

    // Chercher la vraie langue source (première is_auto = false dans l'ordre des locales)
    const manualTranslation = this.resource.translations.find((t) => !t.isAuto)
    if (manualTranslation) {
      sourceLocale = manualTranslation.locale as ContentLocale
    }

    return {
      id: this.resource.id,
      slug: this.resource.slug,
      family: this.resource.family,
      synonyms: this.resource.synonyms ?? [],
      sourceLocale,
      translations,
    }
  }
}
