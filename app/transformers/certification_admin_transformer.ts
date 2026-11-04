import type Certification from '#models/certification'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import { resolveTranslation } from '#shared/helpers/translations'
import type { CertificationAdminType, CertificationDomain } from '#shared/types/certification'

/**
 * Formate une certification pour la liste d'administration : nom résolu dans la
 * locale active, domaine, isEco, nombre de produits (`$extras`).
 */
export default class CertificationAdminTransformer extends BaseTransformer<Certification> {
  constructor(
    resource: Certification,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject(): CertificationAdminType {
    const translation = resolveTranslation(this.resource.translations, this.locale, {
      sourceLocale: this.resource.sourceLocale,
    })

    return {
      id: this.resource.id,
      slug: this.resource.slug,
      name: translation?.name ?? null,
      domain: this.resource.domain as CertificationDomain,
      isEco: this.resource.isEco,
      productsCount: Number(this.resource.$extras.products_count ?? 0),
    }
  }
}
