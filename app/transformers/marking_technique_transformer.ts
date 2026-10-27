import type MarkingTechnique from '#models/marking_technique'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import { resolveTranslation } from '#shared/helpers/translations'
import type { MarkingTechniqueType } from '#shared/types/marking'

/**
 * Technique de marquage (écart 2) localisée pour le frontend. Requiert
 * `translations` préchargé ; repli sur la locale par défaut.
 */
export default class MarkingTechniqueTransformer extends BaseTransformer<MarkingTechnique> {
  constructor(
    resource: MarkingTechnique,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject(): MarkingTechniqueType {
    return {
      id: this.resource.id,
      slug: this.resource.slug,
      name: resolveTranslation(this.resource.translations, this.locale)?.name ?? null,
      family: this.resource.family,
    }
  }
}
