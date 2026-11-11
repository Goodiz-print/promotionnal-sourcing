import { BaseTransformer } from '@adonisjs/core/transformers'
import type QuoteCartItem from '#models/quote_cart_item'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import { estimateLine, tiersForVariant } from '#shared/helpers/price_tiers'
import RfqProductOptionTransformer from '#transformers/rfq_product_option_transformer'
import { ProductDetailVariantTransformer } from '#transformers/product_variant_transformer'
import ProductMarkingPositionTransformer from '#transformers/product_marking_position_transformer'
import ProductPriceTierTransformer from '#transformers/product_price_tier_transformer'
import type {
  QuoteCartItemType,
  QuoteCartMarkingOptionType,
  QuoteCartVariantOptionType,
} from '#shared/types/quote_cart'

/**
 * Ligne du panier telle que l'écran l'affiche : produit, options proposées
 * (variantes actives, couples position × technique) et estimation indicative
 * à partir des grilles dégressives.
 *
 * Requiert `product.{translations, supplier.organization, priceTiers,
 * variants.attributes.{attribute,attributeValue}.translations,
 * markingPositions.techniques.technique.translations, markingPriceTiers}`
 * préchargés (cf. `QuoteCartService#loadItems`).
 */
export default class QuoteCartItemTransformer extends BaseTransformer<QuoteCartItem> {
  constructor(
    resource: QuoteCartItem,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject(): QuoteCartItemType {
    const item = this.resource
    const product = item.product
    const option = new RfqProductOptionTransformer(product, this.locale).toObject()
    const markingOptions = this.markingOptions()
    const marking =
      markingOptions.find((candidate) => candidate.id === item.markingPositionTechniqueId) ?? null
    const markingTechniqueId = this.markingTechniqueId()

    const productTiers = tiersForVariant(
      product.priceTiers.map((tier) => new ProductPriceTierTransformer(tier).toObject()),
      item.variantId
    )

    return {
      id: item.id,
      productId: item.productId,
      productSlug: product.slug,
      productName: option.name,
      imageUrl: product.imageUrl ?? null,
      minQuantity: option.minQuantity,
      quantity: item.quantity,
      note: item.note,
      variantId: item.variantId,
      markingPositionTechniqueId: marking ? marking.id : null,
      markingColors: marking ? item.markingColors : null,
      variantOptions: this.variantOptions(),
      markingOptions,
      estimate: estimateLine({
        productTiers,
        markingTiers: product.markingPriceTiers.filter(
          (tier) => tier.markingTechniqueId === markingTechniqueId
        ),
        withMarking: marking !== null,
        setupCharge: marking?.setupCharge ?? null,
        quantity: item.quantity,
      }),
    }
  }

  /**
   * Variantes actives, libellées par leurs facettes (« Rouge · L »), repli SKU.
   * Deux variantes au même libellé (fréquent dans les flux importés) sont
   * départagées par leur SKU : « Vert (PF-1001) ».
   */
  private variantOptions(): QuoteCartVariantOptionType[] {
    const options = this.resource.product.variants
      .filter((variant) => variant.isActive)
      .map((variant) => {
        const detail = new ProductDetailVariantTransformer(variant, this.locale).toObject()
        const parts = detail.attributes.map((attribute) => attribute.label).filter(Boolean)
        return {
          id: variant.id,
          sku: variant.sku,
          label: parts.length > 0 ? parts.join(' · ') : variant.sku,
        }
      })

    const counts = new Map<string, number>()
    for (const option of options) counts.set(option.label, (counts.get(option.label) ?? 0) + 1)
    return options.map((option) =>
      (counts.get(option.label) ?? 0) > 1 && option.label !== option.sku
        ? { ...option, label: `${option.label} (${option.sku})` }
        : option
    )
  }

  /** Un choix par technique de chaque position : « Face avant — Tampographie ». */
  private markingOptions(): QuoteCartMarkingOptionType[] {
    return this.resource.product.markingPositions.flatMap((position) => {
      const resolved = new ProductMarkingPositionTransformer(position, this.locale).toObject()
      return resolved.techniques.map((technique) => {
        const techniqueName = technique.techniqueName ?? technique.techniqueSlug
        return {
          id: technique.id,
          label: `${resolved.name} — ${techniqueName}`,
          positionName: resolved.name,
          techniqueName,
          maxColors: technique.maxColors,
          setupCharge: technique.defaultSetupCharge,
        }
      })
    })
  }

  /** Technique du marquage choisi, pour filtrer la grille de marquage. */
  private markingTechniqueId(): number | null {
    for (const position of this.resource.product.markingPositions) {
      const found = position.techniques.find(
        (technique) => technique.id === this.resource.markingPositionTechniqueId
      )
      if (found) return found.markingTechniqueId
    }
    return null
  }
}
