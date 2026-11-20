/**
 * Makito (Products API v1.06) : traduction d'une fiche `/products` en
 * `NormalizedProduct`. Fonctions pures, alimentées par l'index des flux annexes
 * (`makito_feed_index.ts`).
 */
import { field } from '#services/supplier_feed/feed_tree'
import {
  cleanString,
  cmToMm,
  groupBy,
  isPresent,
  kgToG,
  normalizeCountry,
  parsePositiveInt,
} from '#shared/helpers/supplier_feed'
import type {
  FeedNode,
  MakitoCatalogueIndex,
  MakitoMarkingRow,
  NormalizedImage,
  NormalizedMarkingPosition,
  NormalizedMarkingTechnique,
  NormalizedPackaging,
  NormalizedProduct,
  NormalizedVariant,
} from '#shared/types/supplier_feed'

/** Taille « sans taille » des déclinaisons (`S/T`, sin talla). */
const NO_SIZE = 'S/T'

const IMAGE_ORDER: NormalizedImage['role'][] = ['primary', 'lifestyle', 'view', 'marked']

function text(node: FeedNode, key: string): string | null {
  return cleanString(field(node, key))
}

/** Rubriques marketing Makito → cycle de vie (libellés des 4 langues importées). */
export function makitoLifecycle(categories: string[]): NormalizedProduct['lifecycleStatus'] {
  const labels = categories.map((category) => category.toLowerCase())
  if (labels.some((label) => /d[eé]stockage|outlet|clearance|liquidaci|restposten/.test(label))) {
    return 'end_of_series'
  }
  if (labels.some((label) => /nouveaut|novedad|new products|neuheit/.test(label))) return 'new'
  return 'active'
}

/**
 * Le nom Makito est un nom de modèle (« Betty ») : on le préfixe du type
 * d'article (« Foulard ») pour qu'il soit lisible et classable, sauf s'il le
 * contient déjà.
 */
export function makitoProductName(model: string, type: string | null): string {
  return type && !model.toLowerCase().includes(type.toLowerCase()) ? `${type} ${model}` : model
}

/** Galerie triée : principale, ambiance, vues, marquées. */
export function sortMakitoImages(images: NormalizedImage[]): NormalizedImage[] {
  return [...images].sort((a, b) => IMAGE_ORDER.indexOf(a.role) - IMAGE_ORDER.indexOf(b.role))
}

/** Déclinaison d'une ligne `/variants` (`matnr` = couleur × taille). */
export function makitoVariant(
  row: FeedNode,
  ref: string,
  index: Pick<MakitoCatalogueIndex, 'colors' | 'stock'>
): NormalizedVariant {
  const sku = text(row, 'matnr') ?? ref
  const colorCode = text(row, 'color')
  const size = text(row, 'size')
  const color = colorCode ? (index.colors.get(colorCode) ?? colorCode) : null
  const image = text(row, 'img100')
  return {
    sku,
    colorLabel: [color, size === NO_SIZE ? null : size].filter(Boolean).join(' / ') || null,
    gtin: null,
    stockQuantity: index.stock.get(sku) ?? null,
    priceTiers: [],
    images: image?.startsWith('http') ? [{ url: image, role: 'view' }] : [],
  }
}

/** Une déclinaison par `matnr` ; sans déclinaison, la fiche seule. */
export function makitoVariants(
  ref: string,
  index: Pick<MakitoCatalogueIndex, 'variants' | 'colors' | 'stock'>
): NormalizedVariant[] {
  const rows = index.variants.get(ref) ?? []
  if (rows.length === 0) {
    return [
      { sku: ref, colorLabel: null, gtin: null, stockQuantity: null, priceTiers: [], images: [] },
    ]
  }
  return rows.map((row) => makitoVariant(row, ref, index))
}

/** Technique d'une ligne de marquage ; `null` si son libellé est inconnu. */
export function makitoTechnique(
  row: MakitoMarkingRow,
  index: Pick<MakitoCatalogueIndex, 'techniqueLabels' | 'techniquePrices'>
): NormalizedMarkingTechnique | null {
  const label = index.techniqueLabels.get(row.techniqueRef)
  if (!label) return null
  const prices = index.techniquePrices.get(row.techniqueRef)
  return {
    label,
    maxColors: row.maxColors,
    setupCharge: prices?.setupCharge ?? null,
    priceTiers: prices?.tiers ?? [],
  }
}

/**
 * Une zone (`print_area_id`) = une position, ses lignes = ses techniques ; la
 * surface est la plus grande de ses lignes. Les zones sans technique connue
 * sont écartées.
 */
export function makitoMarkingPositions(
  markings: MakitoMarkingRow[],
  index: Pick<MakitoCatalogueIndex, 'areaLabels' | 'techniqueLabels' | 'techniquePrices'>
): NormalizedMarkingPosition[] {
  const byArea = groupBy(
    markings,
    (marking) => marking.areaId,
    (marking) => marking
  )
  return [...byArea]
    .map(([areaId, rows]) => ({
      name: index.areaLabels.get(areaId) ?? `Zone ${areaId}`,
      maxWidthMm: Math.max(0, ...rows.map((row) => row.widthMm ?? 0)) || null,
      maxHeightMm: Math.max(0, ...rows.map((row) => row.heightMm ?? 0)) || null,
      techniques: rows.map((row) => makitoTechnique(row, index)).filter(isPresent),
    }))
    .filter((position) => position.techniques.length > 0)
}

/** Conditionnement : poids unitaire (g) et carton maître `ptc_*` (cm, kg). */
export function makitoPackaging(product: FeedNode): NormalizedPackaging {
  return {
    packageType: null,
    unitGrossWeightG: parsePositiveInt(field(product, 'weight')),
    outerCartonQty: parsePositiveInt(field(product, 'ptc_units')),
    outerCartonLengthMm: cmToMm(field(product, 'ptc_length')),
    outerCartonWidthMm: cmToMm(field(product, 'ptc_width')),
    outerCartonHeightMm: cmToMm(field(product, 'ptc_height')),
    // Faute de frappe de l'API : `ptc_wight`.
    outerCartonGrossWeightG: kgToG(field(product, 'ptc_wight') ?? field(product, 'ptc_weight')),
  }
}

/** Fiche (`ref`) et tout ce que les flux annexes en disent. */
export function normalizeMakitoProduct(
  product: FeedNode,
  index: MakitoCatalogueIndex
): NormalizedProduct {
  const ref = text(product, 'ref') ?? ''
  const sheet = index.sheets.get(ref) ?? {}
  const categories = index.categories.get(ref) ?? []
  const markings = index.markings.get(ref) ?? []
  const leadTimes = markings
    .map((marking) => index.leadTimes.get(marking.techniqueRef))
    .filter(isPresent)
  const composition = text(sheet, 'comp')

  return {
    externalId: ref,
    name: makitoProductName(text(product, 'name') ?? ref, text(sheet, 'type')),
    description:
      [index.descriptions.get(ref), text(sheet, 'info')].filter(Boolean).join('\n\n') || null,
    keywords: index.keywords.get(ref) ?? [],
    brand: text(product, 'brand'),
    hsCode: text(product, 'intrastat')?.slice(0, 10) ?? null,
    originCountry: normalizeCountry(field(product, 'country_of_origin')),
    categoryRaw: categories.join(' | ') || null,
    materialLabels: composition ? [composition] : [],
    lifecycleStatus: makitoLifecycle(categories),
    leadTimeDays: leadTimes.length > 0 ? Math.min(...leadTimes) : null,
    videoUrl: null,
    currency: 'EUR',
    priceTiers: index.prices.get(ref) ?? [],
    variants: makitoVariants(ref, index),
    images: sortMakitoImages(index.images.get(ref) ?? []),
    markingPositions: makitoMarkingPositions(markings, index),
    packaging: makitoPackaging(product),
  }
}
