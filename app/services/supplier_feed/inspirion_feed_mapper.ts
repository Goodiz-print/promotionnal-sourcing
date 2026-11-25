/**
 * Inspirion (LEO API) : traduction d'une fiche `v2/products` en
 * `NormalizedProduct`. Fonctions pures, alimentées par l'index des flux annexes
 * (`inspirion_feed_index.ts`).
 */
import { asNode, collect, field } from '#services/supplier_feed/feed_tree'
import {
  asArray,
  cheapestPriceGrid,
  cleanString,
  isPresent,
  lengthToMm,
  normalizeCountry,
  parsePositiveInt,
  stripHtml,
  weightToGrams,
} from '#shared/helpers/supplier_feed'
import type {
  FeedNode,
  InspirionCatalogueIndex,
  InspirionPrintMethod,
  NormalizedImage,
  NormalizedMarkingPosition,
  NormalizedPackaging,
  NormalizedProduct,
  NormalizedVariant,
} from '#shared/types/supplier_feed'

function text(node: FeedNode, key: string): string | null {
  return cleanString(field(node, key))
}

/** Liste de chaînes d'un champ (`keywords`, `materials`), vides écartées. */
function texts(value: unknown): string[] {
  return asArray(value as unknown[])
    .map((item) => cleanString(item))
    .filter(isPresent)
}

/**
 * Images d'une liste `[{ image_url }]` : `preferred`, ou `fallback` si elle est
 * vide (`images_300` peut être un tableau vide alors que `images` est
 * renseigné). La première prend `firstRole`, les suivantes sont des vues.
 */
export function inspirionImages(
  preferred: unknown,
  fallback: unknown,
  firstRole: NormalizedImage['role']
): NormalizedImage[] {
  const list = collect(preferred, ['image_url'])
  return (list.length > 0 ? list : collect(fallback, ['image_url']))
    .map((image) => text(image, 'image_url'))
    .filter((url): url is string => url !== null && url.startsWith('http'))
    .map((url, position) => ({ url, role: position === 0 ? firstRole : ('view' as const) }))
}

/** Déclinaison d'un article (`article_id`) : couleur, EAN, stock, prix, une image. */
export function inspirionVariant(
  article: FeedNode,
  sku: string,
  index: InspirionCatalogueIndex
): NormalizedVariant {
  const articleId = text(article, 'article_id') ?? sku
  return {
    sku: articleId,
    colorLabel: text(article, 'colour'),
    gtin: text(article, 'ean'),
    stockQuantity: index.stock.get(articleId) ?? null,
    priceTiers: index.prices.get(articleId)?.tiers ?? [],
    images: inspirionImages(field(article, 'images_300'), field(article, 'images'), 'view').slice(
      0,
      1
    ),
  }
}

/** Conditionnement d'un article : poids unitaire (`weight`) et carton (`pu`). */
export function inspirionPackaging(article: FeedNode): NormalizedPackaging {
  const weight = asNode(field(article, 'weight'))
  const carton = asNode(field(article, 'pu'))
  return {
    packageType: null,
    unitGrossWeightG: weightToGrams(
      field(weight, 'gross') ?? field(weight, 'net'),
      field(weight, 'unit')
    ),
    outerCartonQty: parsePositiveInt(field(carton, 'pu')),
    outerCartonLengthMm: lengthToMm(field(carton, 'length'), field(carton, 'length_unit')),
    outerCartonWidthMm: lengthToMm(field(carton, 'width'), field(carton, 'width_unit')),
    outerCartonHeightMm: lengthToMm(field(carton, 'height'), field(carton, 'height_unit')),
    outerCartonGrossWeightG: weightToGrams(
      field(carton, 'gross_weight'),
      field(carton, 'weight_unit') ?? 'kg'
    ),
  }
}

/**
 * Plus grande largeur ou hauteur des surfaces d'impression, en mm ; une
 * surface ronde se lit par son diamètre. `null` sans surface exploitable.
 */
export function inspirionPrintAreaMm(areas: FeedNode[], side: 'width' | 'height'): number | null {
  const sizes = areas.map(
    (area) =>
      lengthToMm(
        field(area, side === 'width' ? 'width_bottom' : 'height') ?? field(area, 'diameter'),
        field(area, `${side}_unit`) ?? field(area, 'diameter_unit')
      ) ?? 0
  )
  return Math.max(0, ...sizes) || null
}

/**
 * Méthode d'impression (transfert, tampographie…) → technique, décrite par
 * son code d'impression par défaut (sinon le premier), et surfaces de tous ses
 * codes. `null` sans libellé ou sans code.
 */
export function inspirionPrintMethod(
  method: FeedNode,
  printPrices: InspirionCatalogueIndex['printPrices']
): InspirionPrintMethod | null {
  const codes = collect(field(method, 'print_codes'), ['print_code'])
  const code = codes.find((candidate) => field(candidate, 'default') === true) ?? codes[0]
  const label = text(method, 'print_method_name')
  if (!code || !label) return null
  const prices = printPrices.get(text(code, 'print_code') ?? '')
  return {
    areas: codes.map((candidate) => asNode(field(candidate, 'print_area'))),
    technique: {
      label,
      maxColors: parsePositiveInt(field(code, 'max_colours')),
      setupCharge: prices?.setupCharge ?? null,
      priceTiers: prices?.tiers ?? [],
    },
  }
}

/** Position d'impression et ses techniques ; `null` si aucune n'est exploitable. */
export function inspirionMarkingPosition(
  position: FeedNode,
  printPrices: InspirionCatalogueIndex['printPrices']
): NormalizedMarkingPosition | null {
  const methods = collect(field(position, 'print_methods'), ['print_codes'])
    .map((method) => inspirionPrintMethod(method, printPrices))
    .filter(isPresent)
  if (methods.length === 0) return null
  const areas = methods.flatMap((method) => method.areas)
  return {
    name: text(position, 'position_name') ?? 'Zone',
    maxWidthMm: inspirionPrintAreaMm(areas, 'width'),
    maxHeightMm: inspirionPrintAreaMm(areas, 'height'),
    techniques: methods.map((method) => method.technique),
  }
}

/** Positions de marquage d'un nœud `printdata`. */
export function inspirionMarkingPositions(
  printData: FeedNode,
  printPrices: InspirionCatalogueIndex['printPrices']
): NormalizedMarkingPosition[] {
  return collect(field(printData, 'print_positions'), ['position_name', 'print_methods'])
    .map((position) => inspirionMarkingPosition(position, printPrices))
    .filter(isPresent)
}

/**
 * Fiche (`sku`) et ses déclinaisons (`variants[].article_id`). Poids, carton
 * et image principale viennent du premier article ; rubriques et délai de
 * tous ; le marquage, du premier article qui en porte.
 */
export function normalizeInspirionProduct(
  product: FeedNode,
  index: InspirionCatalogueIndex
): NormalizedProduct {
  const sku = text(product, 'sku') ?? ''
  const articles = collect(field(product, 'variants'), ['article_id'])
  const articleIds = articles.map((article) => text(article, 'article_id')).filter(isPresent)
  const first = articles[0] ?? {}
  const variants = articles.map((article) => inspirionVariant(article, sku, index))
  const deliveryTimes = articleIds.map((id) => index.deliveryTimes.get(id)).filter(isPresent)
  const printData = articleIds.map((id) => index.printData.get(id)).find(isPresent)

  return {
    externalId: sku,
    name: text(product, 'name') ?? sku,
    description: stripHtml(field(product, 'description')),
    keywords: texts(field(product, 'keywords')),
    brand: text(product, 'brand'),
    hsCode: text(product, 'commodity_code')?.replace(/\s/g, '').slice(0, 10) ?? null,
    originCountry: normalizeCountry(field(product, 'origin_country')),
    categoryRaw:
      [...new Set(articleIds.flatMap((id) => index.categories.get(id) ?? []))].join(' | ') || null,
    materialLabels: texts(field(product, 'materials')),
    lifecycleStatus: 'active',
    leadTimeDays: deliveryTimes.length > 0 ? Math.min(...deliveryTimes) : null,
    videoUrl: null,
    currency: index.prices.get(articleIds[0] ?? '')?.currency ?? 'EUR',
    priceTiers: cheapestPriceGrid(variants.map((variant) => variant.priceTiers)),
    variants,
    images: [
      ...inspirionImages(field(first, 'images_300'), field(first, 'images'), 'primary'),
      ...inspirionImages(
        field(product, 'details_images_300'),
        field(product, 'details_images'),
        'view'
      ),
    ],
    markingPositions: printData ? inspirionMarkingPositions(printData, index.printPrices) : [],
    packaging: inspirionPackaging(first),
  }
}
