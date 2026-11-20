/**
 * Makito (Products API v1.06) : indexation des flux annexes. Fonctions pures,
 * une par flux, jointes aux fiches par `ref` (référence produit), `matnr`
 * (déclinaison) ou `technique_ref` (marquage). Les flux couvrent tout le
 * catalogue : seules les lignes des `refs` retenues sont gardées.
 */
import { asNode, collect, field } from '#services/supplier_feed/feed_tree'
import {
  cleanString,
  cmToMm,
  groupBy,
  indexBy,
  lowestByKey,
  parseDecimal,
  parseGroupedInt,
  parsePositiveInt,
  sectionPriceTiers,
  stripHtml,
  sumByKey,
} from '#shared/helpers/supplier_feed'
import type {
  FeedNode,
  MakitoCatalogueIndex,
  MakitoMarkingRow,
  MakitoProductsPage,
  NormalizedImage,
} from '#shared/types/supplier_feed'

/**
 * Dossier d'une image `imgResources` → rôle. Les autres dossiers (`variantes` :
 * déjà portées par les déclinaisons, `cajas` : cartons, rebuts) sont ignorés.
 */
const IMAGE_ROLES: Record<string, NormalizedImage['role']> = {
  principal: 'primary',
  bodegones: 'lifestyle',
  detalles: 'view',
}

function text(node: FeedNode, key: string): string | null {
  return cleanString(field(node, key))
}

/** `ref` de la ligne si elle fait partie des fiches retenues, sinon `null`. */
export function keptRef(row: FeedNode, refs: Set<string>): string | null {
  const ref = text(row, 'ref')
  return ref !== null && refs.has(ref) ? ref : null
}

/** Page de `/products` : ses fiches et la pagination annoncée (`page_info`). */
export function makitoProductsPage(response: unknown): MakitoProductsPage {
  const pageInfo = asNode(field(asNode(response), 'page_info'))
  return {
    products: collect(field(asNode(response), 'products'), ['ref', 'name']),
    lastPage: parsePositiveInt(field(pageInfo, 'last_page')),
    total: parsePositiveInt(field(pageInfo, 'total')),
  }
}

/** `/descriptionslang` : fiche descriptive (type d'article, composition, infos). */
export function indexMakitoSheets(
  feed: unknown,
  refs: Set<string>
): MakitoCatalogueIndex['sheets'] {
  return indexBy(
    collect(feed, ['ref', 'type']),
    (row) => keptRef(row, refs),
    (row) => row
  )
}

/** Description rédigée : `desc` puis `commercial_desc`, sans balise ; `null` si vide. */
export function makitoDescription(row: FeedNode): string | null {
  const parts = [stripHtml(field(row, 'desc')), stripHtml(field(row, 'commercial_desc'))]
  return parts.filter(Boolean).join('\n\n') || null
}

/** `/descriptionextlang` : description par fiche. */
export function indexMakitoDescriptions(
  feed: unknown,
  refs: Set<string>
): MakitoCatalogueIndex['descriptions'] {
  return indexBy(collect(feed, ['ref', 'desc']), (row) => keptRef(row, refs), makitoDescription)
}

/** Mots-clés d'une fiche (`{ <langue>: "mot, mot" }`), dédoublonnés ; `null` si illisible. */
export function makitoKeywords(byLanguage: unknown): string[] | null {
  if (typeof byLanguage !== 'object' || byLanguage === null) return null
  const words = Object.values(byLanguage)
    .flatMap((value) => (cleanString(value) ?? '').split(','))
    .map((word) => word.trim())
    .filter(Boolean)
  return [...new Set(words)]
}

/** `/keywords` : objet `{ keywords: { <ref>: { <langue>: "mot, mot" } } }`. */
export function indexMakitoKeywords(
  feed: unknown,
  refs: Set<string>
): MakitoCatalogueIndex['keywords'] {
  return indexBy(
    Object.entries(asNode(field(asNode(feed), 'keywords'))),
    ([ref]) => (refs.has(ref) ? ref : null),
    ([, byLanguage]) => makitoKeywords(byLanguage)
  )
}

/** `/categories` : rubriques par fiche, dans l'ordre du flux. */
export function indexMakitoCategories(
  feed: unknown,
  refs: Set<string>
): MakitoCatalogueIndex['categories'] {
  return groupBy(
    collect(feed, ['ref', 'category']),
    (row) => keptRef(row, refs),
    (row) => text(row, 'category')
  )
}

/** `/variants` : lignes de déclinaison (`matnr`) par fiche. */
export function indexMakitoVariants(
  feed: unknown,
  refs: Set<string>
): MakitoCatalogueIndex['variants'] {
  return groupBy(
    collect(feed, ['matnr', 'ref']),
    (row) => keptRef(row, refs),
    (row) => row
  )
}

/** `/colors` : libellé traduit par `color_code`. */
export function indexMakitoColors(feed: unknown): MakitoCatalogueIndex['colors'] {
  return indexBy(
    collect(feed, ['color_code', 'name']),
    (row) => text(row, 'color_code'),
    (row) => text(row, 'name')
  )
}

/**
 * `/stockVariants` : une ligne par date de disponibilité ; seul le stock
 * immédiat compte, additionné par `matnr`.
 */
export function indexMakitoStock(feed: unknown, refs: Set<string>): MakitoCatalogueIndex['stock'] {
  return sumByKey(
    collect(feed, ['matnr', 'stock']).flatMap((row) => {
      const matnr = text(row, 'matnr')
      const quantity = parseGroupedInt(field(row, 'stock'))
      const immediate = text(row, 'stock_availability') === 'immediately'
      return matnr !== null && quantity !== null && immediate && keptRef(row, refs) !== null
        ? [[matnr, quantity] as const]
        : []
    })
  )
}

/** `/prices` : paliers par fiche (`section_n` = seuil bas, 6 colonnes). */
export function indexMakitoPrices(
  feed: unknown,
  refs: Set<string>
): MakitoCatalogueIndex['prices'] {
  return indexBy(
    collect(feed, ['ref', 'price_1']),
    (row) => keptRef(row, refs),
    (row) => sectionPriceTiers(row, 'from', 6)
  )
}

/**
 * Image d'une ligne `imgResources` : rôle d'après le dossier de l'URL,
 * `primary` si la ligne est marquée `main`. `null` pour une URL invalide ou un
 * dossier ignoré.
 */
export function makitoImage(row: FeedNode): NormalizedImage | null {
  const url = text(row, 'url')
  if (!url?.startsWith('http')) return null
  const folder = IMAGE_ROLES[url.split('/').at(-2) ?? '']
  const role = Number(field(row, 'main')) === 1 ? 'primary' : folder
  return role ? { url, role } : null
}

/** Une seule image principale : les suivantes deviennent des vues. */
export function singlePrimaryImage(images: NormalizedImage[]): NormalizedImage[] {
  const first = images.findIndex((image) => image.role === 'primary')
  return images.map((image, position) =>
    image.role === 'primary' && position !== first ? { ...image, role: 'view' } : image
  )
}

/** `/imgResources` : galerie par fiche, une seule image principale. */
export function indexMakitoImages(
  feed: unknown,
  refs: Set<string>
): MakitoCatalogueIndex['images'] {
  const byRef = groupBy(collect(feed, ['ref', 'url']), (row) => keptRef(row, refs), makitoImage)
  return new Map([...byRef].map(([ref, images]) => [ref, singlePrimaryImage(images)]))
}

/** Ligne `/markings` : zone, technique, couleurs et surface (cm → mm). */
export function makitoMarkingRow(row: FeedNode): MakitoMarkingRow | null {
  const areaId = text(row, 'print_area_id')
  const techniqueRef = text(row, 'technique_ref')
  if (areaId === null || techniqueRef === null) return null
  return {
    areaId,
    techniqueRef,
    maxColors: parsePositiveInt(field(row, 'max_colors')),
    widthMm: cmToMm(field(row, 'width')),
    heightMm: cmToMm(field(row, 'height')),
  }
}

/** `/markings` : lignes de marquage par fiche. */
export function indexMakitoMarkings(
  feed: unknown,
  refs: Set<string>
): MakitoCatalogueIndex['markings'] {
  return groupBy(
    collect(feed, ['ref', 'technique_ref', 'print_area_id']),
    (row) => keptRef(row, refs),
    makitoMarkingRow
  )
}

/** `/markingsTranslations` : libellé de zone par `print_area_id`. */
export function indexMakitoAreaLabels(feed: unknown): MakitoCatalogueIndex['areaLabels'] {
  return indexBy(
    collect(feed, ['print_area_id', 'txt']),
    (row) => text(row, 'print_area_id'),
    (row) => stripHtml(field(row, 'txt'))
  )
}

/** `/markingTechniques` : libellé par `technique_ref` (le premier du flux l'emporte). */
export function indexMakitoTechniqueLabels(feed: unknown): MakitoCatalogueIndex['techniqueLabels'] {
  return indexBy(
    collect(feed, ['technique_ref', 'name']).reverse(),
    (row) => text(row, 'technique_ref'),
    (row) => stripHtml(field(row, 'name'))
  )
}

/** `/markingTechniquesPrices` : cliché et paliers (`section_n` = borne haute). */
export function indexMakitoTechniquePrices(feed: unknown): MakitoCatalogueIndex['techniquePrices'] {
  return indexBy(
    collect(feed, ['technique_ref', 'price_1']),
    (row) => text(row, 'technique_ref'),
    (row) => {
      const cliche = parseDecimal(field(row, 'cliche'))
      return {
        setupCharge: cliche !== null && cliche > 0 ? cliche : null,
        tiers: sectionPriceTiers(row, 'upTo', 10),
      }
    }
  )
}

/**
 * `/leadtimes` : délai de marquage le plus court par `technique_ref`, en jours
 * (`unit` = `D`), zone export (`EXP`, hors péninsule ibérique).
 */
export function indexMakitoLeadTimes(feed: unknown): MakitoCatalogueIndex['leadTimes'] {
  return lowestByKey(
    collect(feed, ['material', 'printing_lead_time']).flatMap((row) => {
      const techniqueRef = text(row, 'material')
      const days = parsePositiveInt(field(row, 'printing_lead_time'))
      const exportDays = field(row, 'zone_code') === 'EXP' && field(row, 'unit') === 'D'
      return techniqueRef !== null && days !== null && exportDays
        ? [[techniqueRef, days] as const]
        : []
    })
  )
}

/** Indexe tous les flux annexes d'un import, restreints aux `refs` retenues. */
export function buildMakitoIndex(
  refs: Set<string>,
  feeds: Record<keyof MakitoCatalogueIndex, unknown>
): MakitoCatalogueIndex {
  return {
    sheets: indexMakitoSheets(feeds.sheets, refs),
    descriptions: indexMakitoDescriptions(feeds.descriptions, refs),
    keywords: indexMakitoKeywords(feeds.keywords, refs),
    categories: indexMakitoCategories(feeds.categories, refs),
    variants: indexMakitoVariants(feeds.variants, refs),
    colors: indexMakitoColors(feeds.colors),
    stock: indexMakitoStock(feeds.stock, refs),
    prices: indexMakitoPrices(feeds.prices, refs),
    images: indexMakitoImages(feeds.images, refs),
    markings: indexMakitoMarkings(feeds.markings, refs),
    areaLabels: indexMakitoAreaLabels(feeds.areaLabels),
    techniqueLabels: indexMakitoTechniqueLabels(feeds.techniqueLabels),
    techniquePrices: indexMakitoTechniquePrices(feeds.techniquePrices),
    leadTimes: indexMakitoLeadTimes(feeds.leadTimes),
  }
}
