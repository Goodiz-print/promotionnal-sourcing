import { inject } from '@adonisjs/core'
import supplierFeedsConfig from '#config/supplier_feeds'
import SupplierConnector from '#services/supplier_feed/supplier_connector'
import SupplierHttpClient from '#services/supplier_feed/supplier_http_client'
import { collect, field, first } from '#services/supplier_feed/feed_tree'
import { SupplierConnectorNotConfiguredException } from '#exceptions/supplier_feed_errors'
import {
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
  FeedRequestContext,
  FetchCatalogueOptions,
  NormalizedImage,
  NormalizedMarkingPosition,
  NormalizedPriceTier,
  NormalizedProduct,
  NormalizedVariant,
  PfConceptItemPrices,
  PfConceptPrintPrice,
  PfConceptPrintRow,
  SupplierFeedLocale,
} from '#shared/types/supplier_feed'

/** Fichiers par langue (manuel « Data feeds » v3.6.5, p. 7 et 14). */
const PRODUCT_FEED_FILES: Record<SupplierFeedLocale, string> = {
  fr: 'productfeed_fr_v3.json',
  en: 'productfeed_cnl1_en_v3.json',
  de: 'productfeed_de_v3.json',
  es: 'productfeed_es_v3.json',
}

const PRINT_DATA_FILES: Record<SupplierFeedLocale, string> = {
  fr: 'printdata_cfr1_fr_v3.json',
  en: 'printdata_cnl1_en_v3.json',
  de: 'printdata_cde1_de_v3.json',
  es: 'printdata_ces1_es_v3.json',
}

/** Champs `imageData` → rôle d'image de la plateforme. */
function imageRole(key: string): NormalizedImage['role'] {
  if (key === 'imageMain') return 'primary'
  if (key.startsWith('imageMood') || key === 'imageModel' || key === 'imageGroup') {
    return 'lifestyle'
  }
  if (key.startsWith('imageLogo')) return 'marked'
  return 'view'
}

/** Paliers triés, dédoublonnés par quantité de départ. */
function sortTiers(tiers: NormalizedPriceTier[]): NormalizedPriceTier[] {
  const byQuantity = new Map<number, number>()
  for (const tier of tiers) byQuantity.set(tier.minQuantity, tier.unitPrice)
  return [...byQuantity.entries()]
    .sort(([a], [b]) => a - b)
    .map(([minQuantity, unitPrice]) => ({ minQuantity, unitPrice }))
}

/**
 * PF Concept : flux JSON v3 (manuel « Data feeds » v3.6.5).
 *
 * - produits et données de marquage : flux publics, par langue ;
 * - prix nets, stock et prix de marquage : flux **propres au compte**, dont
 *   l'URL porte le code distributeur `PFCONCEPT_FEED_CODE` (secret).
 *
 * Un *model* devient un produit, un *item* (couleur / taille) une variante.
 */
@inject()
export default class PfConceptConnector extends SupplierConnector {
  readonly key = 'pfconcept' as const

  readonly identity = {
    slug: 'pf-concept',
    name: 'PF Concept',
    country: 'NL',
    website: 'https://www.pfconcept.com',
  }

  constructor(protected http: SupplierHttpClient) {
    super()
  }

  isConfigured(): boolean {
    return Boolean(supplierFeedsConfig.pfconcept.feedCode)
  }

  async fetchCatalogue({
    limit,
    locale,
    refresh,
    onMissingFeed,
  }: FetchCatalogueOptions): Promise<NormalizedProduct[]> {
    const code = supplierFeedsConfig.pfconcept.feedCode
    if (!code) {
      throw new SupplierConnectorNotConfiguredException('PFCONCEPT_FEED_CODE manquant dans .env')
    }

    const base = supplierFeedsConfig.pfconcept.baseUrl
    const context: FeedRequestContext = { cache: { refresh: refresh ?? false }, onMissingFeed }
    const productFeed = await this.http.getJson(
      `${base}/${PRODUCT_FEED_FILES[locale]}`,
      {},
      context.cache
    )
    const models = collect(productFeed, ['modelCode', 'items'], limit ?? undefined)

    // Les autres flux sont joints par code article ; on ne garde que les articles retenus.
    const itemCodes = new Set(models.flatMap((model) => this.itemCodes(model)))

    const [prices, stock, printRows, printPrices] = await Promise.all([
      this.loadPrices(`${base}/pricefeed_${code}_v3.json`, itemCodes, context),
      this.loadStock(`${base}/stockfeed_${code}_v3.json`, itemCodes, context),
      this.loadPrintRows(`${base}/${PRINT_DATA_FILES[locale]}`, itemCodes, context),
      this.loadPrintPrices(`${base}/printpricefeed_${code}_v3.json`, context),
    ])

    return models.map((model) => this.normalize(model, prices, stock, printRows, printPrices))
  }

  private itemCodes(model: FeedNode): string[] {
    return collect(field(model, 'items'), ['itemCode'])
      .map((item) => cleanString(field(item, 'itemCode')))
      .filter((code): code is string => code !== null)
  }

  /** Prix nets par article (`scales[].priceBar` / `nettPrice`) + devise. */
  async loadPrices(
    url: string,
    itemCodes: Set<string>,
    context: FeedRequestContext
  ): Promise<Map<string, PfConceptItemPrices>> {
    const feed = await this.optionalFeed('prix', url, context)
    const result = new Map<string, PfConceptItemPrices>()
    for (const item of collect(feed, ['itemcode', 'scales'])) {
      const code = cleanString(field(item, 'itemcode'))
      if (!code || !itemCodes.has(code)) continue
      // `promotion` porte aussi des `scales` (prix standard barré) : on ne lit que les prix nets.
      const tiers = collect(field(item, 'scales'), ['priceBar', 'nettPrice'])
        .map((scale) => ({
          minQuantity: parsePositiveInt(field(scale, 'priceBar')),
          unitPrice: parseDecimal(field(scale, 'nettPrice')),
        }))
        .filter(
          (tier): tier is NormalizedPriceTier =>
            tier.minQuantity !== null && tier.unitPrice !== null && tier.unitPrice > 0
        )
      result.set(code, {
        currency: cleanString(field(item, 'currency')) ?? 'EUR',
        tiers: sortTiers(tiers),
      })
    }
    return result
  }

  /** Stock disponible par article (`stockDirect`). */
  async loadStock(
    url: string,
    itemCodes: Set<string>,
    context: FeedRequestContext
  ): Promise<Map<string, number>> {
    const feed = await this.optionalFeed('stock', url, context)
    const result = new Map<string, number>()
    for (const item of collect(feed, ['itemCode', 'stockDirect'])) {
      const code = cleanString(field(item, 'itemCode'))
      const quantity = parseDecimal(field(item, 'stockDirect'))
      if (code && itemCodes.has(code) && quantity !== null) result.set(code, Math.max(0, quantity))
    }
    return result
  }

  /** Options de marquage par article : `printfeedrefs` → `printFeedRows` (par `ref`). */
  async loadPrintRows(
    url: string,
    itemCodes: Set<string>,
    context: FeedRequestContext
  ): Promise<Map<string, PfConceptPrintRow[]>> {
    const feed = await this.optionalFeed('marquage', url, context)
    const rowsByRef = new Map<string, PfConceptPrintRow>()
    for (const row of collect(feed, ['ref', 'printCode', 'impMethod'])) {
      const ref = cleanString(field(row, 'ref'))
      const printCode = cleanString(field(row, 'printCode'))
      const method = cleanString(field(row, 'impMethod'))
      if (!ref || !printCode || !method) continue
      rowsByRef.set(ref, {
        location: cleanString(field(row, 'impLocation')) ?? method,
        method,
        printCode,
        maxColors: parsePositiveInt(field(row, 'maxColours')),
        widthMm: parsePositiveInt(field(row, 'impWidthMm')),
        heightMm: parsePositiveInt(field(row, 'impHeightMm')),
      })
    }

    const result = new Map<string, PfConceptPrintRow[]>()
    for (const item of collect(feed, ['itemCode', 'printfeedrefs'])) {
      const code = cleanString(field(item, 'itemCode'))
      if (!code || !itemCodes.has(code)) continue
      const rows = collect(field(item, 'printfeedrefs'), ['ref'])
        .map((ref) => rowsByRef.get(cleanString(field(ref, 'ref')) ?? ''))
        .filter((row): row is PfConceptPrintRow => row !== undefined)
      result.set(code, rows)
    }
    return result
  }

  /**
   * Prix de marquage par code d'impression. On retient la première taille de
   * logo, une couleur, un passage : c'est le prix « d'appel » affichable.
   */
  async loadPrintPrices(
    url: string,
    context: FeedRequestContext
  ): Promise<Map<string, PfConceptPrintPrice>> {
    const feed = await this.optionalFeed('prix de marquage', url, context)
    const result = new Map<string, PfConceptPrintPrice>()
    for (const charge of collect(feed, ['printCode', 'logoSizes'])) {
      const printCode = cleanString(field(charge, 'printCode'))
      if (!printCode) continue
      const setup = first(field(charge, 'logoSizes'), ['SetupCharge', 'decoPrices'])
      if (!setup) continue
      const tiers = collect(field(setup, 'decoPrices'), ['decoPriceFromQty'])
        .map((price) => ({
          minQuantity: parsePositiveInt(field(price, 'decoPriceFromQty')),
          unitPrice: parseDecimal(field(price, 'price')),
        }))
        .filter(
          (tier): tier is NormalizedPriceTier =>
            tier.minQuantity !== null && tier.unitPrice !== null
        )
      result.set(printCode, {
        setupCharge: parseDecimal(field(setup, 'SetupCharge')),
        tiers: sortTiers(tiers),
      })
    }
    return result
  }

  /**
   * Un flux annexe en échec (pas encore activé côté PF, indisponible le
   * week-end…) n'empêche pas l'import du catalogue : on journalise et on
   * continue sans ces données.
   */
  private optionalFeed(feed: string, url: string, context: FeedRequestContext): Promise<unknown> {
    return this.optional(feed, context, () => this.http.getJson(url, {}, context.cache))
  }

  normalize(
    model: FeedNode,
    prices: Map<string, PfConceptItemPrices>,
    stock: Map<string, number>,
    printRows: Map<string, PfConceptPrintRow[]>,
    printPrices: Map<string, PfConceptPrintPrice>
  ): NormalizedProduct {
    const items = collect(field(model, 'items'), ['itemCode'])
    const firstItem = items[0] ?? {}
    const imageBase = supplierFeedsConfig.pfconcept.imageBaseUrl

    const variants: NormalizedVariant[] = items.map((item) => {
      const code = cleanString(field(item, 'itemCode')) ?? ''
      const color = first(field(item, 'colors'), ['colorCode']) ?? {}
      const colorParts = [
        cleanString(field(color, 'baseColor')),
        cleanString(field(color, 'colorDesc')),
      ]
      const main = cleanString(field(first(item, ['imageMain']) ?? {}, 'imageMain'))
      return {
        sku: code,
        colorLabel: colorParts.filter(Boolean).join(' / ') || null,
        gtin: cleanString(field(item, 'eanCode')),
        stockQuantity: stock.get(code) ?? null,
        priceTiers: prices.get(code)?.tiers ?? [],
        images: main ? [{ url: `${imageBase}${main}`, role: 'primary' as const }] : [],
      }
    })

    // Images de la fiche : celles du premier article.
    const imageData = first(firstItem, ['imageMain']) ?? {}
    const images: NormalizedImage[] = Object.entries(imageData)
      .map(([key, value]) => ({ key, file: cleanString(value) }))
      .filter((entry): entry is { key: string; file: string } => entry.file !== null)
      .map(({ key, file }) => ({ url: `${imageBase}${file}`, role: imageRole(key) }))

    // Prix de la fiche : la grille complète de l'article le moins cher.
    const productTiers = cheapestPriceGrid(variants.map((variant) => variant.priceTiers))

    const category = first(firstItem, ['catDesc']) ?? {}
    const categoryRaw = [
      cleanString(field(category, 'groupDesc')),
      cleanString(field(category, 'catDesc')),
    ]
      .filter(Boolean)
      .join(' > ')

    const firstCode = cleanString(field(firstItem, 'itemCode')) ?? ''
    const measurements = first(firstItem, ['weightGr']) ?? {}
    const decoDefault = first(firstItem, ['method', 'leadTime']) ?? {}

    return {
      externalId: cleanString(field(model, 'modelCode')) ?? firstCode,
      name: cleanString(field(model, 'description')) ?? firstCode,
      description: cleanString(field(model, 'extDesc')),
      keywords: (cleanString(field(model, 'keywords')) ?? '')
        .split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean)
        .slice(0, 30),
      brand: cleanString(field(firstItem, 'brand')),
      // Code douane conservé tel quel (chiffres seulement) : retirer les zéros de
      // fin corromprait les codes significatifs (`8471300000` → `84713`).
      hsCode: cleanString(field(firstItem, 'hsCode'))?.replace(/\D/g, '').slice(0, 10) || null,
      originCountry: normalizeCountry(field(firstItem, 'countryOfOrigin')),
      categoryRaw: categoryRaw || null,
      materialLabels: [
        cleanString(field(firstItem, 'material')),
        cleanString(field(firstItem, 'simpleMaterial')),
      ].filter((label): label is string => label !== null),
      lifecycleStatus: 'active',
      leadTimeDays: parsePositiveInt(field(decoDefault, 'leadTime')),
      videoUrl: cleanString(field(firstItem, 'videoUrl1')),
      currency: prices.get(firstCode)?.currency ?? 'EUR',
      priceTiers: productTiers,
      variants,
      images,
      markingPositions: this.markingPositions(printRows.get(firstCode) ?? [], printPrices),
      packaging: {
        packageType: cleanString(field(first(firstItem, ['decoPackaging']) ?? {}, 'decoPackaging')),
        unitGrossWeightG: parsePositiveInt(field(measurements, 'weightGr')),
        outerCartonQty: parsePositiveInt(field(firstItem, 'qtyPerCarton')),
        outerCartonLengthMm: cmToMm(field(firstItem, 'exportLcm')),
        outerCartonWidthMm: cmToMm(field(firstItem, 'exportWcm')),
        outerCartonHeightMm: cmToMm(field(firstItem, 'exportHcm')),
        outerCartonGrossWeightG: kgToG(field(firstItem, 'grossWeightKg')),
      },
    }
  }

  /** Lignes de marquage regroupées par emplacement ; une technique par code d'impression. */
  private markingPositions(
    rows: PfConceptPrintRow[],
    printPrices: Map<string, PfConceptPrintPrice>
  ): NormalizedMarkingPosition[] {
    const byLocation = new Map<string, NormalizedMarkingPosition>()
    for (const row of rows) {
      const position = byLocation.get(row.location) ?? {
        name: row.location,
        maxWidthMm: row.widthMm,
        maxHeightMm: row.heightMm,
        techniques: [],
      }
      position.maxWidthMm = Math.max(position.maxWidthMm ?? 0, row.widthMm ?? 0) || null
      position.maxHeightMm = Math.max(position.maxHeightMm ?? 0, row.heightMm ?? 0) || null
      const price = printPrices.get(row.printCode)
      if (!position.techniques.some((technique) => technique.label === row.method)) {
        position.techniques.push({
          label: row.method,
          maxColors: row.maxColors,
          setupCharge: price?.setupCharge ?? null,
          priceTiers: price?.tiers ?? [],
        })
      }
      byLocation.set(row.location, position)
    }
    return [...byLocation.values()]
  }
}
