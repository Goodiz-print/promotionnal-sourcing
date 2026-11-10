import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import supplierFeedsConfig from '#config/supplier_feeds'
import SupplierConnector from '#services/supplier_feed/supplier_connector'
import SupplierHttpClient from '#services/supplier_feed/supplier_http_client'
import { collect, field } from '#services/supplier_feed/feed_tree'
import { SupplierConnectorNotConfiguredException } from '#exceptions/supplier_feed_errors'
import {
  asArray,
  cheapestPriceGrid,
  cleanString,
  cmToMm,
  kgToG,
  normalizeCountry,
  parseDecimal,
  parsePositiveInt,
} from '#shared/helpers/supplier_feed'
import type {
  FeedNode,
  FetchCatalogueOptions,
  NormalizedImage,
  NormalizedMarkingPosition,
  NormalizedPriceTier,
  NormalizedProduct,
  NormalizedVariant,
  PassotProductGroup,
} from '#shared/types/supplier_feed'

function tiersFrom(nodes: unknown, priceKey: string): NormalizedPriceTier[] {
  const byQuantity = new Map<number, number>()
  for (const node of collect(nodes, ['qty', priceKey])) {
    const minQuantity = parsePositiveInt(field(node, 'qty'))
    const unitPrice = parseDecimal(field(node, priceKey))
    if (minQuantity !== null && unitPrice !== null && unitPrice >= 0) {
      byQuantity.set(minQuantity, unitPrice)
    }
  }
  return [...byQuantity.entries()]
    .sort(([a], [b]) => a - b)
    .map(([minQuantity, unitPrice]) => ({ minQuantity, unitPrice }))
}

/** Liste de libellés depuis une valeur chaîne (`"a, b"`) ou tableau. */
function labels(value: unknown): string[] {
  return asArray(value as unknown[])
    .flatMap((entry) => (cleanString(entry) ?? '').split(/[,;/]/))
    .map((entry) => entry.trim())
    .filter(Boolean)
}

/**
 * Passot Innovation (PiDesign) : API REST Magento (doc « PiDesign.eu API »
 * v1.0.3). Toutes les routes exigent l'en-tête `PI-API-KEY` (secret
 * `PASSOT_API_KEY`) ; les prix renvoyés sont les **prix nets du compte**.
 *
 * - `catalog/products` : produits *simple* (déclinaisons) et *configurable*
 *   (fiche parente), reliés par `main_sku` ;
 * - `catalog/prices` / `catalog/stock` : par SKU de déclinaison ;
 * - `customization/zones` : zones de marquage par SKU parent.
 */
@inject()
export default class PassotConnector extends SupplierConnector {
  readonly key = 'passot' as const

  readonly identity = {
    slug: 'passot-innovation',
    name: 'Passot Innovation',
    country: 'FR',
    website: 'https://www.pidesign.eu',
  }

  constructor(protected http: SupplierHttpClient) {
    super()
  }

  isConfigured(): boolean {
    return Boolean(supplierFeedsConfig.passot.apiKey)
  }

  async fetchCatalogue({ limit, locale }: FetchCatalogueOptions): Promise<NormalizedProduct[]> {
    const apiKey = supplierFeedsConfig.passot.apiKey
    if (!apiKey) {
      throw new SupplierConnectorNotConfiguredException('PASSOT_API_KEY manquant dans .env')
    }
    const headers = { 'PI-API-KEY': apiKey }
    const base = `${supplierFeedsConfig.passot.baseUrl}/${locale}/rest/V1`

    const productsFeed = await this.http.getJson(`${base}/catalog/products`, headers)
    const groups = this.group(collect(productsFeed, ['sku', 'type_id'])).slice(0, limit)

    const [prices, stock, zones] = await Promise.all([
      this.optionalFeed(`${base}/catalog/prices`, headers),
      this.optionalFeed(`${base}/catalog/stock`, headers),
      this.optionalFeed(`${base}/customization/zones`, headers),
    ])

    const tiersBySku = new Map<string, NormalizedPriceTier[]>()
    for (const item of collect(prices, ['sku', 'tier_prices'])) {
      const sku = cleanString(field(item, 'sku'))
      if (sku) tiersBySku.set(sku, tiersFrom(field(item, 'tier_prices'), 'value'))
    }

    const stockBySku = new Map<string, number>()
    for (const item of collect(stock, ['sku', 'quantity'])) {
      const sku = cleanString(field(item, 'sku'))
      const quantity = parseDecimal(field(item, 'quantity'))
      if (sku && quantity !== null) stockBySku.set(sku, Math.max(0, quantity))
    }

    const zonesByProduct = new Map<string, FeedNode[]>()
    for (const zone of collect(zones, ['product', 'methods'])) {
      const product = cleanString(field(zone, 'product'))
      if (!product) continue
      zonesByProduct.set(product, [...(zonesByProduct.get(product) ?? []), zone])
    }

    return groups.map((group) =>
      this.normalize(group, tiersBySku, stockBySku, zonesByProduct.get(group.parentSku) ?? [])
    )
  }

  /**
   * Regroupe les déclinaisons sous leur parent. Sans `main_sku`, le parent est
   * déduit du préfixe avant `#` (`PICUP22#15122` → `PICUP22`). L'ordre du flux
   * est conservé.
   */
  group(items: FeedNode[]): PassotProductGroup[] {
    const groups = new Map<string, PassotProductGroup>()
    for (const item of items) {
      const sku = cleanString(field(item, 'sku'))
      if (!sku) continue
      const isParent = cleanString(field(item, 'type_id')) === 'configurable'
      const parentSku = isParent
        ? sku
        : (cleanString(field(item, 'main_sku')) ?? sku.split('#')[0] ?? sku)
      const group = groups.get(parentSku) ?? { parentSku, parent: null, children: [] }
      if (isParent) group.parent = item
      else group.children.push(item)
      groups.set(parentSku, group)
    }
    return [...groups.values()]
  }

  private async optionalFeed(url: string, headers: Record<string, string>): Promise<unknown> {
    try {
      return await this.http.getJson(url, headers)
    } catch (error) {
      logger.warn({ err: error }, 'passot optional feed unavailable, continuing without it')
      return null
    }
  }

  private images(item: FeedNode | undefined): NormalizedImage[] {
    if (!item) return []
    const base = supplierFeedsConfig.passot.imageBaseUrl
    return collect(field(item, 'media_gallery_entries'), ['file'])
      .filter((entry) => (cleanString(field(entry, 'media_type')) ?? 'image') === 'image')
      .map((entry) => cleanString(field(entry, 'file')))
      .filter((file): file is string => file !== null)
      .map((file, index) => ({
        url: `${base}${file.startsWith('/') ? '' : '/'}${file}`,
        role: index === 0 ? ('primary' as const) : ('view' as const),
      }))
  }

  private lifecycle(item: FeedNode): NormalizedProduct['lifecycleStatus'] {
    const status = cleanString(field(item, 'catalogue_status'))?.toUpperCase()
    const options = labels(field(item, 'product_options')).map((option) => option.toLowerCase())
    if (status === 'DES' || status === 'ANR' || options.includes('fds')) return 'end_of_series'
    if (options.some((option) => option.startsWith('nouveaut'))) return 'new'
    return 'active'
  }

  normalize(
    group: PassotProductGroup,
    tiersBySku: Map<string, NormalizedPriceTier[]>,
    stockBySku: Map<string, number>,
    zones: FeedNode[]
  ): NormalizedProduct {
    // Fiche de référence : le parent configurable, sinon la première déclinaison.
    const sheet = group.parent ?? group.children[0] ?? {}
    // Les SKU « Echantillon » sont des échantillons, pas des déclinaisons vendables.
    const sellable = group.children.filter(
      (child) => cleanString(field(child, 'color'))?.toLowerCase() !== 'echantillon'
    )
    const children = sellable.length > 0 ? sellable : [sheet]

    const variants: NormalizedVariant[] = children.map((child) => {
      const sku = cleanString(field(child, 'sku')) ?? group.parentSku
      const colorParts = [cleanString(field(child, 'color')), cleanString(field(child, 'shape'))]
      return {
        sku,
        colorLabel: colorParts.filter(Boolean).join(' / ') || null,
        gtin: cleanString(field(child, 'ean')),
        stockQuantity: stockBySku.get(sku) ?? null,
        priceTiers: tiersBySku.get(sku) ?? [],
        images: this.images(child).slice(0, 1),
      }
    })

    // Paliers de la fiche : ceux du parent s'il en a, sinon la grille complète
    // de la déclinaison la moins chère (un parent présent sans palier exploitable
    // ne doit pas masquer les prix des déclinaisons).
    const parentTiers = tiersBySku.get(group.parentSku) ?? []
    const productTiers =
      parentTiers.length > 0
        ? parentTiers
        : cheapestPriceGrid(variants.map((variant) => variant.priceTiers))

    const images = this.images(group.parent ?? undefined)
    const methods = zones.flatMap((zone) =>
      collect(field(zone, 'methods'), ['name', 'prices']).filter(
        (method) => field(method, 'is_priority') !== true
      )
    )
    const delays = methods
      .map((method) => parsePositiveInt(field(method, 'delay')))
      .filter((delay): delay is number => delay !== null)

    return {
      externalId: group.parentSku,
      name: cleanString(field(sheet, 'name')) ?? group.parentSku,
      description: cleanString(field(sheet, 'description')),
      keywords: [],
      brand: null,
      hsCode: cleanString(field(sheet, 'custom_code'))?.slice(0, 10) ?? null,
      originCountry: normalizeCountry(field(sheet, 'country_origin')),
      // `categories` : liste de rubriques du catalogue Passot (« Porte-clés jeton »…).
      categoryRaw: labels(field(sheet, 'categories')).join(' | ') || null,
      materialLabels: labels(field(sheet, 'material')),
      lifecycleStatus: this.lifecycle(sheet),
      leadTimeDays: delays.length > 0 ? Math.min(...delays) : null,
      videoUrl: null,
      currency: 'EUR',
      priceTiers: productTiers,
      variants,
      images: images.length > 0 ? images : this.images(group.children[0]),
      markingPositions: this.markingPositions(zones),
      packaging: {
        packageType:
          cleanString(field(sheet, 'package_unit_type')) ??
          cleanString(field(sheet, 'package_type')),
        unitGrossWeightG: kgToG(field(sheet, 'weight')),
        outerCartonQty: parsePositiveInt(field(sheet, 'qty_per_carton')),
        outerCartonLengthMm: cmToMm(field(sheet, 'package_length')),
        outerCartonWidthMm: cmToMm(field(sheet, 'package_width')),
        outerCartonHeightMm: cmToMm(field(sheet, 'package_height')),
        outerCartonGrossWeightG: kgToG(field(sheet, 'package_weight')),
      },
    }
  }

  /** Une zone = une position ; ses méthodes (hors express `is_priority`) = techniques. */
  private markingPositions(zones: FeedNode[]): NormalizedMarkingPosition[] {
    return zones
      .map((zone) => ({
        name: cleanString(field(zone, 'name')) ?? 'Zone',
        maxWidthMm: parsePositiveInt(field(zone, 'width')),
        maxHeightMm: parsePositiveInt(field(zone, 'height')),
        techniques: collect(field(zone, 'methods'), ['name', 'prices'])
          .filter((method) => field(method, 'is_priority') !== true)
          .map((method) => ({
            label: cleanString(field(method, 'name')) ?? '',
            maxColors: parsePositiveInt(field(method, 'max_color')),
            setupCharge: parseDecimal(field(method, 'order_fee')),
            priceTiers: tiersFrom(field(method, 'prices'), 'price'),
          }))
          .filter((technique) => technique.label !== ''),
      }))
      .filter((position) => position.techniques.length > 0)
  }
}
