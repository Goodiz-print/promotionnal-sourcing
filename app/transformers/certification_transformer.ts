import type Certification from '#models/certification'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import { resolveTranslation } from '#shared/helpers/translations'
import type { CertificationType } from '#shared/types/certification'

/**
 * Label de conformité (écart 4) localisé pour le frontend. Requiert
 * `translations` préchargé ; repli sur la locale par défaut.
 */
export default class CertificationTransformer extends BaseTransformer<Certification> {
  constructor(
    resource: Certification,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject(): CertificationType {
    return {
      id: this.resource.id,
      slug: this.resource.slug,
      name: resolveTranslation(this.resource.translations, this.locale)?.name ?? null,
      domain: this.resource.domain,
      isEco: this.resource.isEco,
    }
  }
}
