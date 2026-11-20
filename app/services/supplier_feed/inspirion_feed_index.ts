/**
 * Inspirion (LEO API) : indexation des flux annexes. Fonctions pures, une par
 * flux, jointes aux fiches par `article_id` (ou code d'impression).
 */
import { collect, field } from '#services/supplier_feed/feed_tree'
import {
  cleanString,
  indexBy,
  isPresent,
  lowestByKey,
  parseDecimal,
  parsePositiveInt,
  sortedPriceTiers,
} from '#shared/helpers/supplier_feed'
import type {
  FeedNode,
  InspirionCatalogueIndex,
  NormalizedPriceTier,
} from '#shared/types/supplier_feed'

function text(node: FeedNode, key: string): string | null {
  return cleanString(field(node, key))
}

/**
 * Paliers d'une liste `[{ <quantityKey>, price }]`, triés ; les lignes sans
 * quantité ou sans prix strictement positif sont écartées.
 */
export function inspirionPriceTiers(
  scales: FeedNode[],
  quantityKey: 'bulk_volume' | 'quantity'
): NormalizedPriceTier[] {
  return sortedPriceTiers(
    scales.flatMap((scale) => {
      const minQuantity = parsePositiveInt(field(scale, quantityKey))
      const unitPrice = parseDecimal(field(scale, 'price'))
      return minQuantity !== null && unitPrice !== null && unitPrice > 0
        ? [{ minQuantity, unitPrice }]
        : []
    })
  )
}

/** `v2/pricelist` : prix du compte et devise (`EUR` par défaut) par article. */
export function indexInspirionPrices(feed: unknown): InspirionCatalogueIndex['prices'] {
  return indexBy(
    collect(feed, ['article_id', 'pricelist']),
    (item) => text(item, 'article_id'),
    (item) => {
      const scales = collect(field(item, 'pricelist'), ['price', 'bulk_volume'])
      return {
        currency: text(scales[0] ?? {}, 'currency') ?? 'EUR',
        tiers: inspirionPriceTiers(scales, 'bulk_volume'),
      }
    }
  )
}

/** `v1/stock` : stock France par article, jamais négatif. */
export function indexInspirionStock(feed: unknown): InspirionCatalogueIndex['stock'] {
  return indexBy(
    collect(feed, ['article_id', 'stock_france']),
    (item) => text(item, 'article_id'),
    (item) => {
      const quantity = parseDecimal(field(item, 'stock_france'))
      return quantity === null ? null : Math.max(0, quantity)
    }
  )
}

/** Rubrique traduite « parent > rubrique » (libellé brut en repli), `null` si vide. */
export function inspirionCategoryLabel(category: FeedNode): string | null {
  const label = [
    text(category, 'parent_category_translation'),
    text(category, 'category_translation') ?? text(category, 'category'),
  ]
    .filter(isPresent)
    .join(' > ')
  return label || null
}

/** `v1/products/categories` : rubriques dédoublonnées par article. */
export function indexInspirionCategories(feed: unknown): InspirionCatalogueIndex['categories'] {
  return indexBy(
    collect(feed, ['articleId', 'categories']),
    (item) => text(item, 'articleId'),
    (item) => [
      ...new Set(
        collect(field(item, 'categories'), ['category'])
          .map(inspirionCategoryLabel)
          .filter(isPresent)
      ),
    ]
  )
}

/** `v1/printdata` : nœud de marquage (positions, méthodes, codes) par article. */
export function indexInspirionPrintData(feed: unknown): InspirionCatalogueIndex['printData'] {
  return indexBy(
    collect(feed, ['article_id', 'print_positions']),
    (item) => text(item, 'article_id'),
    (item) => item
  )
}

/** `v2/print-prices` : frais fixes et paliers par code d'impression. */
export function indexInspirionPrintPrices(feed: unknown): InspirionCatalogueIndex['printPrices'] {
  return indexBy(
    collect(feed, ['printcode', 'pricelist']),
    (item) => text(item, 'printcode'),
    (item) => ({
      setupCharge: parseDecimal(field(item, 'setup')),
      tiers: inspirionPriceTiers(
        collect(field(item, 'pricelist'), ['quantity', 'price']),
        'quantity'
      ),
    })
  )
}

/**
 * `v2/delivery-time` : délai le plus court par article, **avec marquage**
 * (ligne portant un `print_code`) ; sans marquage en repli seulement.
 */
export function indexInspirionDeliveryTimes(
  feed: unknown
): InspirionCatalogueIndex['deliveryTimes'] {
  const rows = collect(feed, ['article_id', 'delivery_days']).flatMap((item) => {
    const articleId = text(item, 'article_id')
    const days = parsePositiveInt(field(item, 'delivery_days'))
    return articleId !== null && days !== null
      ? [{ articleId, days, printed: text(item, 'print_code') !== null }]
      : []
  })
  const shortest = (printed: boolean) =>
    lowestByKey(
      rows.filter((row) => row.printed === printed).map((row) => [row.articleId, row.days] as const)
    )
  // Les délais avec marquage écrasent ceux sans marquage.
  return new Map([...shortest(false), ...shortest(true)])
}

/** Indexe tous les flux annexes d'un import. */
export function buildInspirionIndex(
  feeds: Record<keyof InspirionCatalogueIndex, unknown>
): InspirionCatalogueIndex {
  return {
    prices: indexInspirionPrices(feeds.prices),
    stock: indexInspirionStock(feeds.stock),
    categories: indexInspirionCategories(feeds.categories),
    printData: indexInspirionPrintData(feeds.printData),
    printPrices: indexInspirionPrintPrices(feeds.printPrices),
    deliveryTimes: indexInspirionDeliveryTimes(feeds.deliveryTimes),
  }
}
