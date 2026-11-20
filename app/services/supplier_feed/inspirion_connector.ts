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
  normalizeCountry,
  parseDecimal,
  parsePositiveInt,
} from '#shared/helpers/supplier_feed'
import type {
  FeedCacheOptions,
  FeedNode,
  FetchCatalogueOptions,
  InspirionCatalogueIndex,
  NormalizedImage,
  NormalizedMarkingPosition,
  NormalizedMarkingTechnique,
  NormalizedPriceTier,
  NormalizedProduct,
  NormalizedVariant,
} from '#shared/types/supplier_feed'

function node(value: unknown): FeedNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as FeedNode)
    : {}
}

/** Texte sans balise HTML (les descriptions portent des `<b>`). */
function plain(value: unknown): string | null {
  return cleanString(cleanString(value)?.replace(/<[^>]+>/g, '') ?? null)
}

/** Longueur → millimètres selon l'unité annoncée (`cm` par défaut). */
function toMm(value: unknown, unit: unknown): number | null {
  const length = parseDecimal(value)
  if (length === null || length <= 0) return null
  return Math.round(cleanString(unit)?.toLowerCase() === 'mm' ? length : length * 10)
}

/** Poids → grammes selon l'unité annoncée (`g` par défaut). */
function toGrams(value: unknown, unit: unknown): number | null {
  const weight = parseDecimal(value)
  if (weight === null || weight <= 0) return null
  return Math.round(cleanString(unit)?.toLowerCase() === 'kg' ? weight * 1000 : weight)
}

function sortedTiers(byQuantity: Map<number, number>): NormalizedPriceTier[] {
  return [...byQuantity.entries()]
    .sort(([a], [b]) => a - b)
    .map(([minQuantity, unitPrice]) => ({ minQuantity, unitPrice }))
}

/**
 * Inspirion : LEO API (`https://leoapi.inspirion.eu`, doc en ligne
 * `/documentation`). Toutes les routes exigent l'en-tête `X-Gateway-API-Key`
 * (secret `INSPIRION_API_KEY`, clé **client**) ; les prix sont ceux du compte.
 *
 * - `v2/products` : fiches (`sku`) et déclinaisons (`variants[].article_id`),
 *   sans pagination ;
 * - `v2/pricelist`, `v1/stock`, `v1/products/categories`, `v2/delivery-time` :
 *   par `article_id` ;
 * - `v1/printdata` (positions et codes d'impression par article) joint à
 *   `v2/print-prices` par code d'impression.
 */
@inject()
export default class InspirionConnector extends SupplierConnector {
  readonly key = 'inspirion' as const

  readonly identity = {
    slug: 'inspirion',
    name: 'Inspirion',
    country: 'DE',
    website: 'https://www.inspirion.eu',
  }

  constructor(protected http: SupplierHttpClient) {
    super()
  }

  isConfigured(): boolean {
    return Boolean(supplierFeedsConfig.inspirion.apiKey)
  }

  async fetchCatalogue({
    limit,
    locale,
    refresh,
  }: FetchCatalogueOptions): Promise<NormalizedProduct[]> {
    const { apiKey, baseUrl } = supplierFeedsConfig.inspirion
    if (!apiKey) {
      throw new SupplierConnectorNotConfiguredException('INSPIRION_API_KEY manquant dans .env')
    }
    const headers = { 'X-Gateway-API-Key': apiKey }
    const cache = { refresh: refresh ?? false }

    const productsFeed = await this.http.getJson(
      `${baseUrl}/api/v2/products?language=${locale}`,
      headers,
      cache
    )
    const products = collect(productsFeed, ['sku', 'variants']).slice(0, limit ?? undefined)

    const [prices, stock, categories, printData, printPrices, deliveryTimes] = await Promise.all([
      this.optionalFeed(`${baseUrl}/api/v2/pricelist`, headers, cache),
      this.optionalFeed(`${baseUrl}/api/v1/stock`, headers, cache),
      this.optionalFeed(`${baseUrl}/api/v1/products/categories?language=${locale}`, headers, cache),
      this.optionalFeed(`${baseUrl}/api/v1/printdata?language=${locale}`, headers, cache),
      this.optionalFeed(`${baseUrl}/api/v2/print-prices`, headers, cache),
      this.optionalFeed(`${baseUrl}/api/v2/delivery-time`, headers, cache),
    ])
    const index = this.index({ prices, stock, categories, printData, printPrices, deliveryTimes })

    return products.map((product) => this.normalize(product, index))
  }

  private async optionalFeed(
    url: string,
    headers: Record<string, string>,
    cache: FeedCacheOptions
  ): Promise<unknown> {
    try {
      return await this.http.getJson(url, headers, cache)
    } catch (error) {
      logger.warn({ err: error }, 'inspirion optional feed unavailable, continuing without it')
      return null
    }
  }

  /** Indexe les flux annexes par `article_id` (ou code d'impression). */
  index(feeds: Record<keyof InspirionCatalogueIndex, unknown>): InspirionCatalogueIndex {
    const index: InspirionCatalogueIndex = {
      prices: new Map(),
      stock: new Map(),
      categories: new Map(),
      printData: new Map(),
      printPrices: new Map(),
      deliveryTimes: new Map(),
    }

    for (const item of collect(feeds.prices, ['article_id', 'pricelist'])) {
      const articleId = cleanString(field(item, 'article_id'))
      if (!articleId) continue
      const scales = collect(field(item, 'pricelist'), ['price', 'bulk_volume'])
      const byQuantity = new Map<number, number>()
      for (const scale of scales) {
        const minQuantity = parsePositiveInt(field(scale, 'bulk_volume'))
        const unitPrice = parseDecimal(field(scale, 'price'))
        if (minQuantity !== null && unitPrice !== null && unitPrice > 0) {
          byQuantity.set(minQuantity, unitPrice)
        }
      }
      index.prices.set(articleId, {
        currency: cleanString(field(scales[0] ?? {}, 'currency')) ?? 'EUR',
        tiers: sortedTiers(byQuantity),
      })
    }

    for (const item of collect(feeds.stock, ['article_id', 'stock_france'])) {
      const articleId = cleanString(field(item, 'article_id'))
      const quantity = parseDecimal(field(item, 'stock_france'))
      if (articleId && quantity !== null) index.stock.set(articleId, Math.max(0, quantity))
    }

    for (const item of collect(feeds.categories, ['articleId', 'categories'])) {
      const articleId = cleanString(field(item, 'articleId'))
      if (!articleId) continue
      const labels = collect(field(item, 'categories'), ['category']).map((category) =>
        [
          cleanString(field(category, 'parent_category_translation')),
          cleanString(field(category, 'category_translation')) ??
            cleanString(field(category, 'category')),
        ]
          .filter(Boolean)
          .join(' > ')
      )
      index.categories.set(articleId, [...new Set(labels.filter(Boolean))])
    }

    for (const item of collect(feeds.printData, ['article_id', 'print_positions'])) {
      const articleId = cleanString(field(item, 'article_id'))
      if (articleId) index.printData.set(articleId, item)
    }

    for (const item of collect(feeds.printPrices, ['printcode', 'pricelist'])) {
      const code = cleanString(field(item, 'printcode'))
      if (!code) continue
      const byQuantity = new Map<number, number>()
      for (const scale of collect(field(item, 'pricelist'), ['quantity', 'price'])) {
        const minQuantity = parsePositiveInt(field(scale, 'quantity'))
        const unitPrice = parseDecimal(field(scale, 'price'))
        if (minQuantity !== null && unitPrice !== null && unitPrice >= 0) {
          byQuantity.set(minQuantity, unitPrice)
        }
      }
      index.printPrices.set(code, {
        setupCharge: parseDecimal(field(item, 'setup')),
        tiers: sortedTiers(byQuantity),
      })
    }

    // Délai avec marquage le plus court par article ; sans marquage en repli.
    const unprinted = new Map<string, number>()
    for (const item of collect(feeds.deliveryTimes, ['article_id', 'delivery_days'])) {
      const articleId = cleanString(field(item, 'article_id'))
      const days = parsePositiveInt(field(item, 'delivery_days'))
      if (!articleId || days === null) continue
      const target = cleanString(field(item, 'print_code')) ? index.deliveryTimes : unprinted
      target.set(articleId, Math.min(days, target.get(articleId) ?? days))
    }
    for (const [articleId, days] of unprinted) {
      if (!index.deliveryTimes.has(articleId)) index.deliveryTimes.set(articleId, days)
    }

    return index
  }

  /** Images d'une liste `[{ image_url }]`, la première en `primary`. */
  private images(list: unknown, firstRole: NormalizedImage['role']): NormalizedImage[] {
    return collect(list, ['image_url'])
      .map((image) => cleanString(field(image, 'image_url')))
      .filter((url): url is string => url !== null && url.startsWith('http'))
      .map((url, position) => ({ url, role: position === 0 ? firstRole : ('view' as const) }))
  }

  normalize(product: FeedNode, index: InspirionCatalogueIndex): NormalizedProduct {
    const sku = cleanString(field(product, 'sku')) ?? ''
    const articles = collect(field(product, 'variants'), ['article_id'])
    const articleIds = articles
      .map((article) => cleanString(field(article, 'article_id')))
      .filter((id): id is string => id !== null)
    const first = articles[0] ?? {}

    const variants: NormalizedVariant[] = articles.map((article) => {
      const articleId = cleanString(field(article, 'article_id')) ?? sku
      const images = this.images(field(article, 'images_300') ?? field(article, 'images'), 'view')
      return {
        sku: articleId,
        colorLabel: cleanString(field(article, 'colour')),
        gtin: cleanString(field(article, 'ean')),
        stockQuantity: index.stock.get(articleId) ?? null,
        priceTiers: index.prices.get(articleId)?.tiers ?? [],
        images: images.slice(0, 1),
      }
    })

    const gallery = [
      ...this.images(field(first, 'images_300') ?? field(first, 'images'), 'primary'),
      ...this.images(
        field(product, 'details_images_300') ?? field(product, 'details_images'),
        'view'
      ),
    ]
    const categories = new Set(articleIds.flatMap((id) => index.categories.get(id) ?? []))
    const deliveryTimes = articleIds
      .map((id) => index.deliveryTimes.get(id))
      .filter((days): days is number => days !== undefined)
    const weight = node(field(first, 'weight'))
    const carton = node(field(first, 'pu'))
    const printed = articleIds.map((id) => index.printData.get(id)).find(Boolean)

    return {
      externalId: sku,
      name: cleanString(field(product, 'name')) ?? sku,
      description: plain(field(product, 'description')),
      keywords: asArray(field(product, 'keywords') as unknown[])
        .map((keyword) => cleanString(keyword))
        .filter((keyword): keyword is string => keyword !== null),
      brand: cleanString(field(product, 'brand')),
      hsCode:
        cleanString(field(product, 'commodity_code'))?.replace(/\s/g, '').slice(0, 10) ?? null,
      originCountry: normalizeCountry(field(product, 'origin_country')),
      categoryRaw: [...categories].join(' | ') || null,
      materialLabels: asArray(field(product, 'materials') as unknown[])
        .map((material) => cleanString(material))
        .filter((material): material is string => material !== null),
      lifecycleStatus: 'active',
      leadTimeDays: deliveryTimes.length > 0 ? Math.min(...deliveryTimes) : null,
      videoUrl: null,
      currency: index.prices.get(articleIds[0] ?? '')?.currency ?? 'EUR',
      priceTiers: cheapestPriceGrid(variants.map((variant) => variant.priceTiers)),
      variants,
      images: gallery,
      markingPositions: printed ? this.markingPositions(printed, index) : [],
      packaging: {
        packageType: null,
        unitGrossWeightG: toGrams(
          field(weight, 'gross') ?? field(weight, 'net'),
          field(weight, 'unit')
        ),
        outerCartonQty: parsePositiveInt(field(carton, 'pu')),
        outerCartonLengthMm: toMm(field(carton, 'length'), field(carton, 'length_unit')),
        outerCartonWidthMm: toMm(field(carton, 'width'), field(carton, 'width_unit')),
        outerCartonHeightMm: toMm(field(carton, 'height'), field(carton, 'height_unit')),
        outerCartonGrossWeightG: toGrams(
          field(carton, 'gross_weight'),
          field(carton, 'weight_unit') ?? 'kg'
        ),
      },
    }
  }

  /**
   * Une position d'impression = une position ; chaque méthode (transfert,
   * tampographie…) = une technique, décrite par son code d'impression par
   * défaut (sinon le premier) : surface, couleurs, prix du code.
   */
  private markingPositions(
    printData: FeedNode,
    index: InspirionCatalogueIndex
  ): NormalizedMarkingPosition[] {
    return collect(field(printData, 'print_positions'), ['position_name', 'print_methods'])
      .map((position) => {
        const areas: FeedNode[] = []
        const techniques: NormalizedMarkingTechnique[] = []
        for (const method of collect(field(position, 'print_methods'), ['print_codes'])) {
          const codes = collect(field(method, 'print_codes'), ['print_code'])
          const code = codes.find((candidate) => field(candidate, 'default') === true) ?? codes[0]
          const label = cleanString(field(method, 'print_method_name'))
          if (!code || !label) continue
          areas.push(...codes.map((candidate) => node(field(candidate, 'print_area'))))
          const prices = index.printPrices.get(cleanString(field(code, 'print_code')) ?? '')
          techniques.push({
            label,
            maxColors: parsePositiveInt(field(code, 'max_colours')),
            setupCharge: prices?.setupCharge ?? null,
            priceTiers: prices?.tiers ?? [],
          })
        }
        const widths = areas.map(
          (area) =>
            toMm(
              field(area, 'width_bottom') ?? field(area, 'diameter'),
              field(area, 'width_unit') ?? field(area, 'diameter_unit')
            ) ?? 0
        )
        const heights = areas.map(
          (area) =>
            toMm(
              field(area, 'height') ?? field(area, 'diameter'),
              field(area, 'height_unit') ?? field(area, 'diameter_unit')
            ) ?? 0
        )
        return {
          name: cleanString(field(position, 'position_name')) ?? 'Zone',
          maxWidthMm: Math.max(0, ...widths) || null,
          maxHeightMm: Math.max(0, ...heights) || null,
          techniques,
        }
      })
      .filter((position) => position.techniques.length > 0)
  }
}
