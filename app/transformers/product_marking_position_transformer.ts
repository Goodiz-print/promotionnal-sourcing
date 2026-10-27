import type ProductMarkingPosition from '#models/product_marking_position'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import { resolveTranslation } from '#shared/helpers/translations'
import type { ProductMarkingPositionType } from '#shared/types/marking'

/**
 * Position de marquage (écart 2) sérialisée pour le frontend : ses techniques
 * possibles sont résolues dans la locale active (libellé de technique). Requiert
 * `techniques.technique.translations` préchargé.
 */
export default class ProductMarkingPositionTransformer extends BaseTransformer<ProductMarkingPosition> {
  constructor(
    resource: ProductMarkingPosition,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject(): ProductMarkingPositionType {
    return {
      id: this.resource.id,
      name: this.resource.name,
      maxWidthMm: this.resource.maxWidthMm,
      maxHeightMm: this.resource.maxHeightMm,
      templateDocumentId: this.resource.templateDocumentId,
      position: this.resource.position,
      techniques: this.resource.techniques.map((pt) => ({
        id: pt.id,
        markingTechniqueId: pt.markingTechniqueId,
        techniqueSlug: pt.technique?.slug ?? '',
        techniqueName: resolveTranslation(pt.technique?.translations, this.locale)?.name ?? null,
        techniqueFamily: pt.technique?.family ?? '',
        maxColors: pt.maxColors,
        defaultSetupCharge: pt.defaultSetupCharge,
      })),
    }
  }
}
