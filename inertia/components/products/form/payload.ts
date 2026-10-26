import { CONTENT_LOCALES, type ContentLocale } from '#shared/types/i18n'
import type { ProductEditType } from '#shared/types/product'
import type { ProductFormState } from './types'

/**
 * Locales à envoyer : la source toujours, les autres seulement si renseignées et
 * modifiées (une traduction auto non touchée n'est pas renvoyée — elle resterait
 * « auto »). Une langue laissée vide est générée par le serveur.
 */
export function changedTranslations(data: ProductFormState, product?: ProductEditType) {
  const payload: Partial<Record<ContentLocale, { name?: string; description: string | null }>> = {}
  for (const current of CONTENT_LOCALES) {
    const { name, description } = data.translations[current]
    const initial = product?.translations[current]
    const unchanged =
      initial !== undefined && initial.name === name && (initial.description ?? '') === description
    if (current !== data.sourceLocale && (!name || unchanged)) continue
    payload[current] = { name: name || undefined, description: description || null }
  }
  return payload
}

/**
 * Construit le payload envoyé au serveur depuis l'état du formulaire. Les champs
 * numériques/texte vides sont omis (VineJS les traite comme absents) ; les blocs
 * « remplacement d'ensemble » (variantes, paliers, conditionnement, marquage)
 * sont toujours transmis pour pouvoir être vidés à l'édition.
 */
export function buildProductPayload(
  data: ProductFormState,
  product?: ProductEditType
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    categoryId: data.categoryId,
    sourceLocale: data.sourceLocale,
    translations: changedTranslations(data, product),
    currency: data.currency || 'EUR',
    madeInEurope: data.madeInEurope,
    isActive: data.isActive,
    isConfigurable: data.isConfigurable,
    lifecycleStatus: data.lifecycleStatus,
    rushService: data.rushService,
    attributeValueIds: data.attributeValueIds,
    // Conformité (écart 4) : labels sélectionnés (tableau toujours envoyé).
    certificationIds: data.certificationIds,
    images: data.images,
    removedImageIds: data.removedImageIds,
    variants: data.variants
      .filter((variant) => variant.sku.trim())
      .map((variant) => ({
        ...variant,
        sku: variant.sku.trim(),
        gtin: variant.gtin.trim() || null,
      })),
    priceTiers: data.priceTiers
      .filter((tier) => tier.minQuantity !== null && tier.unitPrice !== null)
      .map((tier) => ({ ...tier, variantSku: tier.variantSku || null })),
    // Marquage structuré (écart 2) : `printable` + remplacement d'ensemble des
    // positions (avec leurs techniques) et de la grille de prix de marquage.
    printable: data.printable,
    markingPositions: data.markingPositions
      .filter((position) => position.name.trim())
      .map((position) => ({
        name: position.name.trim(),
        maxWidthMm: position.maxWidthMm,
        maxHeightMm: position.maxHeightMm,
        templateDocumentId: position.templateDocumentId,
        techniques: position.techniques
          .filter((technique) => technique.markingTechniqueId !== null)
          .map((technique) => ({
            markingTechniqueId: technique.markingTechniqueId,
            maxColors: technique.maxColors,
            defaultSetupCharge: technique.defaultSetupCharge,
          })),
      })),
    markingPriceTiers: data.markingPriceTiers
      .filter(
        (tier) =>
          tier.markingTechniqueId !== null && tier.minQuantity !== null && tier.unitPrice !== null
      )
      .map((tier) => ({
        markingTechniqueId: tier.markingTechniqueId,
        minQuantity: tier.minQuantity,
        unitPrice: tier.unitPrice,
      })),
  }
  if (data.priceMin !== null) payload.priceMin = data.priceMin
  if (data.priceMax !== null) payload.priceMax = data.priceMax
  if (data.minQuantity !== null) payload.minQuantity = data.minQuantity
  if (data.originCountry) payload.originCountry = data.originCountry
  // Champs texte optionnels : omis quand vides (VineJS = absents).
  if (data.brand.trim()) payload.brand = data.brand.trim()
  if (data.hsCode.trim()) payload.hsCode = data.hsCode.trim()
  if (data.releasedAt) payload.releasedAt = data.releasedAt
  if (data.supplierCategoryRaw.trim()) payload.supplierCategoryRaw = data.supplierCategoryRaw.trim()
  if (data.leadTimeDays !== null) payload.leadTimeDays = data.leadTimeDays
  if (data.rushLeadTimeDays !== null) payload.rushLeadTimeDays = data.rushLeadTimeDays
  if (data.videoUrl.trim()) payload.videoUrl = data.videoUrl.trim()
  // Conformité (écart 4) : toujours envoyés (null quand vides) pour pouvoir être
  // **effacés** à l'édition — vider le recyclé retire l'allégation et recale
  // `is_eco` (une valeur omise serait conservée en base).
  payload.recycledContentPercent = data.recycledContentPercent
  payload.cautionComment = data.cautionComment.trim() || null
  // Conditionnement (écart 3) : toujours envoyé (null quand vide) pour pouvoir
  // être effacé à l'édition — un champ omis serait conservé en base.
  payload.packaging = {
    packageType: data.packaging.packageType.trim() || null,
    unitGrossWeightG: data.packaging.unitGrossWeightG,
    innerCartonQty: data.packaging.innerCartonQty,
    outerCartonQty: data.packaging.outerCartonQty,
    outerCartonLengthMm: data.packaging.outerCartonLengthMm,
    outerCartonWidthMm: data.packaging.outerCartonWidthMm,
    outerCartonHeightMm: data.packaging.outerCartonHeightMm,
    outerCartonGrossWeightG: data.packaging.outerCartonGrossWeightG,
    outerCartonVolumeM3: data.packaging.outerCartonVolumeM3,
  }
  return payload
}
