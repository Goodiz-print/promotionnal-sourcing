import { inject } from '@adonisjs/core'
import supplierFeedsConfig from '#config/supplier_feeds'
import SupplierConnector from '#services/supplier_feed/supplier_connector'
import SupplierHttpClient from '#services/supplier_feed/supplier_http_client'
import { collect } from '#services/supplier_feed/feed_tree'
import { buildInspirionIndex } from '#services/supplier_feed/inspirion_feed_index'
import { normalizeInspirionProduct } from '#services/supplier_feed/inspirion_feed_mapper'
import { SupplierConnectorNotConfiguredException } from '#exceptions/supplier_feed_errors'
import type {
  FeedRequestContext,
  FetchCatalogueOptions,
  NormalizedProduct,
} from '#shared/types/supplier_feed'

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
 *
 * Ce connecteur ne fait que lire les flux : l'indexation des flux annexes est
 * dans `inspirion_feed_index.ts`, la traduction des fiches dans
 * `inspirion_feed_mapper.ts` (fonctions pures, testées une à une).
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
    onMissingFeed,
  }: FetchCatalogueOptions): Promise<NormalizedProduct[]> {
    const { apiKey, baseUrl } = supplierFeedsConfig.inspirion
    if (!apiKey) {
      throw new SupplierConnectorNotConfiguredException('INSPIRION_API_KEY manquant dans .env')
    }
    const headers = { 'X-Gateway-API-Key': apiKey }
    const context: FeedRequestContext = { cache: { refresh: refresh ?? false }, onMissingFeed }

    const productsFeed = await this.http.getJson(
      `${baseUrl}/api/v2/products?language=${locale}`,
      headers,
      context.cache
    )
    const products = collect(productsFeed, ['sku', 'variants']).slice(0, limit ?? undefined)

    const [prices, stock, categories, printData, printPrices, deliveryTimes] = await Promise.all([
      this.optionalFeed('prix', `${baseUrl}/api/v2/pricelist`, headers, context),
      this.optionalFeed('stock', `${baseUrl}/api/v1/stock`, headers, context),
      this.optionalFeed(
        'catégories',
        `${baseUrl}/api/v1/products/categories?language=${locale}`,
        headers,
        context
      ),
      this.optionalFeed(
        'marquage',
        `${baseUrl}/api/v1/printdata?language=${locale}`,
        headers,
        context
      ),
      this.optionalFeed('prix de marquage', `${baseUrl}/api/v2/print-prices`, headers, context),
      this.optionalFeed('délais', `${baseUrl}/api/v2/delivery-time`, headers, context),
    ])
    const index = buildInspirionIndex({
      prices,
      stock,
      categories,
      printData,
      printPrices,
      deliveryTimes,
    })

    return products.map((product) => normalizeInspirionProduct(product, index))
  }

  private optionalFeed(
    feed: string,
    url: string,
    headers: Record<string, string>,
    context: FeedRequestContext
  ): Promise<unknown> {
    return this.optional(feed, context, () => this.http.getJson(url, headers, context.cache))
  }
}
