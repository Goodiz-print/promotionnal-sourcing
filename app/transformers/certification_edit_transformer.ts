import type Certification from '#models/certification'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { CONTENT_LOCALES, type ContentLocale } from '#shared/types/i18n'
import type { CertificationEditType, CertificationDomain } from '#shared/types/certification'

/**
 * Formate une certification pour le formulaire d'édition : une entrée de nom
 * par langue de contenu (chaîne vide si absente), domaine, isEco, synonymes.
 */
export default class CertificationEditTransformer extends BaseTransformer<Certification> {
  toObject(): CertificationEditType {
    const translations = {} as CertificationEditType['translations']
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
      domain: this.resource.domain as CertificationDomain,
      isEco: this.resource.isEco,
      synonyms: this.resource.synonyms ?? [],
      sourceLocale: this.resource.sourceLocale as ContentLocale,
      translations,
    }
  }
}
