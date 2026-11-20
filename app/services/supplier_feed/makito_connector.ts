import { inject } from '@adonisjs/core'
import supplierFeedsConfig from '#config/supplier_feeds'
import SupplierConnector from '#services/supplier_feed/supplier_connector'
import SupplierHttpClient from '#services/supplier_feed/supplier_http_client'
import { collect, field } from '#services/supplier_feed/feed_tree'
import {
  SupplierConnectorNotConfiguredException,
  SupplierFeedHttpException,
  SupplierFeedIncompleteException,
} from '#exceptions/supplier_feed_errors'
import {
  cleanString,
  cmToMm,
  kgToG,
  normalizeCountry,
  parseDecimal,
  parseGroupedInt,
  parsePositiveInt,
  sectionPriceTiers,
} from '#shared/helpers/supplier_feed'
import type {
  FeedCacheOptions,
  FeedNode,
  FeedRequestContext,
  FetchCatalogueOptions,
  MakitoCatalogueIndex,
  MakitoMarkingRow,
  NormalizedImage,
  NormalizedMarkingPosition,
  NormalizedProduct,
  NormalizedVariant,
  SupplierFeedLocale,
} from '#shared/types/supplier_feed'

/** Identifiants de langue de l'API (doc v1.06, « Language IDs »). */
const LANGUAGE_IDS: Record<SupplierFeedLocale, number> = { es: 1, en: 2, fr: 4, de: 6 }

/** Produits demandés par page (`/products` est le seul flux paginé). */
const PAGE_SIZE = 1000

/** Taille « sans taille » des déclinaisons (`S/T`, sin talla). */
const NO_SIZE = 'S/T'

/**
 * Dossier d'une image `imgResources` → rôle. Les autres dossiers (`variantes` :
 * déjà portées par les déclinaisons, `cajas` : cartons, rebuts) sont ignorés.
 */
const IMAGE_ROLES: Record<string, NormalizedImage['role']> = {
  principal: 'primary',
  bodegones: 'lifestyle',
  detalles: 'view',
}
const IMAGE_ORDER: NormalizedImage['role'][] = ['primary', 'lifestyle', 'view', 'marked']

/** Libellé sans balise HTML (`cm<sup>2</sup>` → `cm2`). */
function plain(value: unknown): string | null {
  return cleanString(cleanString(value)?.replace(/<[^>]+>/g, '') ?? null)
}

function push<T>(map: Map<string, T[]>, key: string, value: T) {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

/**
 * Makito : API REST « Products API » v1.06 (`https://data.makito.es/api`).
 * `POST /login` (identifiants du compte client) renvoie un jeton, envoyé
 * ensuite en `Authorization: Bearer`. Seul `/products` est paginé ; tous les
 * autres flux renvoient le catalogue entier et sont joints par `ref`
 * (référence produit), `matnr` (déclinaison) ou `technique_ref` (marquage).
 *
 * L'API est lente (jusqu'à 2 min par flux) : les réponses passent par le
 * cache disque du client HTTP.
 */
@inject()
export default class MakitoConnector extends SupplierConnector {
  readonly key = 'makito' as const

  readonly identity = {
    slug: 'makito',
    name: 'Makito',
    country: 'ES',
    website: 'https://www.makito.es',
  }

  constructor(protected http: SupplierHttpClient) {
    super()
  }

  isConfigured(): boolean {
    return Boolean(supplierFeedsConfig.makito.email && supplierFeedsConfig.makito.password)
  }

  async fetchCatalogue({
    limit,
    locale,
    refresh,
    onMissingFeed,
  }: FetchCatalogueOptions): Promise<NormalizedProduct[]> {
    const { baseUrl, email, password } = supplierFeedsConfig.makito
    if (!email || !password) {
      throw new SupplierConnectorNotConfiguredException(
        'MAKITO_EMAIL / MAKITO_PASSWORD manquants dans .env'
      )
    }
    const headers = { Authorization: `Bearer ${await this.login(baseUrl, email, password)}` }
    // Le jeton change à chaque login : le cache est rattaché au compte, pas au jeton.
    const context: FeedRequestContext = {
      cache: { refresh: refresh ?? false, scope: email },
      onMissingFeed,
    }
    const lang = LANGUAGE_IDS[locale]

    const products = await this.products(baseUrl, headers, context.cache, limit)
    const refs = new Set(products.map((product) => cleanString(field(product, 'ref')) ?? ''))
    const feed = (path: string) =>
      this.optional(path, context, () =>
        this.http.getJson(`${baseUrl}/${path}`, headers, context.cache)
      )

    // Séquentiel : l'API sert mal les gros flux en parallèle.
    const index = this.index(refs, {
      sheets: await feed(`descriptionslang/${lang}`),
      descriptions: await feed(`descriptionextlang/${lang}`),
      keywords: await feed(`keywords/${lang}`),
      categories: await feed(`categories/${lang}`),
      variants: await feed('variants'),
      colors: await feed(`colors/${lang}`),
      stock: await feed('stockVariants'),
      prices: await feed('prices'),
      images: await feed('imgResources'),
      markings: await feed('markings'),
      areaLabels: await feed(`markingsTranslations/${lang}`),
      techniqueLabels: await feed(`markingTechniques/${lang}`),
      techniquePrices: await feed('markingTechniquesPrices'),
      leadTimes: await feed('leadtimes'),
    })

    return products.map((product) => this.normalize(product, index))
  }

  /**
   * Jeton d'accès. La doc annonce un champ `token` ; l'API réelle le renvoie
   * dans `msg` (`{ status: 1, msg: "<id>|<jeton>" }`). Identifiants refusés :
   * pas de jeton reconnaissable.
   */
  private async login(baseUrl: string, email: string, password: string): Promise<string> {
    const response = await this.http.postJson<FeedNode>(`${baseUrl}/login`, { email, password })
    const token = [field(response, 'token'), field(response, 'msg')]
      .map((value) => cleanString(value))
      .find((value) => value !== null && /^\d+\|\S+$/.test(value))
    if (!token) throw new SupplierFeedHttpException('Makito : identifiants refusés par /login')
    return token
  }

  /**
   * Pages de `/products` jusqu'à `limit` fiches ou la dernière page. Un
   * catalogue **entier** doit être complet : s'il manque des fiches par rapport
   * au `total` annoncé (page vide, pagination absente), on échoue plutôt que de
   * laisser l'importeur désactiver les fiches « absentes ».
   */
  private async products(
    baseUrl: string,
    headers: Record<string, string>,
    cache: FeedCacheOptions,
    limit: number | null
  ): Promise<FeedNode[]> {
    const perPage = Math.min(limit ?? PAGE_SIZE, PAGE_SIZE)
    const products: FeedNode[] = []
    let total: number | null = null
    for (let page = 1; ; page++) {
      const response = await this.http.getJson<FeedNode>(
        `${baseUrl}/products?page=${page}&per_page=${perPage}`,
        headers,
        cache
      )
      const rows = collect(field(response, 'products'), ['ref', 'name'])
      products.push(...rows)
      const pageInfo = (field(response, 'page_info') ?? {}) as FeedNode
      const lastPage = parsePositiveInt(field(pageInfo, 'last_page'))
      total = parsePositiveInt(field(pageInfo, 'total')) ?? total
      const complete = limit !== null && products.length >= limit
      if (rows.length === 0 || complete || lastPage === null || page >= lastPage) break
    }
    if (limit !== null) return products.slice(0, limit)
    if (total === null || products.length < total) {
      throw new SupplierFeedIncompleteException(
        `Makito : catalogue incomplet (${products.length} fiche(s) reçue(s) sur ${total ?? 'un total inconnu'})`
      )
    }
    return products
  }

  /** Indexe les flux annexes, restreints aux `refs` retenues. */
  index(
    refs: Set<string>,
    feeds: Record<keyof MakitoCatalogueIndex, unknown>
  ): MakitoCatalogueIndex {
    const index: MakitoCatalogueIndex = {
      sheets: new Map(),
      descriptions: new Map(),
      keywords: new Map(),
      categories: new Map(),
      variants: new Map(),
      colors: new Map(),
      stock: new Map(),
      prices: new Map(),
      images: new Map(),
      markings: new Map(),
      areaLabels: new Map(),
      techniqueLabels: new Map(),
      techniquePrices: new Map(),
      leadTimes: new Map(),
    }
    /** `ref` de la ligne si elle fait partie des fiches retenues. */
    const kept = (row: FeedNode): string | null => {
      const ref = cleanString(field(row, 'ref'))
      return ref !== null && refs.has(ref) ? ref : null
    }

    for (const row of collect(feeds.sheets, ['ref', 'type'])) {
      const ref = kept(row)
      if (ref) index.sheets.set(ref, row)
    }
    for (const row of collect(feeds.descriptions, ['ref', 'desc'])) {
      const ref = kept(row)
      const text = [field(row, 'desc'), field(row, 'commercial_desc')]
        .map((part) => plain(part))
        .filter(Boolean)
        .join('\n\n')
      if (ref && text) index.descriptions.set(ref, text)
    }
    // `keywords` : objet `{ <ref>: { <langue>: "mot, mot" } }`.
    const keywords = field((feeds.keywords ?? {}) as FeedNode, 'keywords')
    if (typeof keywords === 'object' && keywords !== null) {
      for (const [ref, byLanguage] of Object.entries(keywords)) {
        if (!refs.has(ref) || typeof byLanguage !== 'object' || byLanguage === null) continue
        const words = Object.values(byLanguage)
          .flatMap((value) => (cleanString(value) ?? '').split(','))
          .map((word) => word.trim())
          .filter(Boolean)
        index.keywords.set(ref, [...new Set(words)])
      }
    }
    for (const row of collect(feeds.categories, ['ref', 'category'])) {
      const ref = kept(row)
      const category = cleanString(field(row, 'category'))
      if (ref && category) push(index.categories, ref, category)
    }
    for (const row of collect(feeds.variants, ['matnr', 'ref'])) {
      const ref = kept(row)
      if (ref) push(index.variants, ref, row)
    }
    for (const row of collect(feeds.colors, ['color_code', 'name'])) {
      const code = cleanString(field(row, 'color_code'))
      const name = cleanString(field(row, 'name'))
      if (code && name) index.colors.set(code, name)
    }
    // Une ligne par date de disponibilité : seul le stock immédiat compte.
    for (const row of collect(feeds.stock, ['matnr', 'stock'])) {
      const matnr = cleanString(field(row, 'matnr'))
      const quantity = parseGroupedInt(field(row, 'stock'))
      if (!matnr || quantity === null || !kept(row)) continue
      if (cleanString(field(row, 'stock_availability')) !== 'immediately') continue
      index.stock.set(matnr, (index.stock.get(matnr) ?? 0) + quantity)
    }
    for (const row of collect(feeds.prices, ['ref', 'price_1'])) {
      const ref = kept(row)
      if (ref) index.prices.set(ref, sectionPriceTiers(row, 'from', 6))
    }
    for (const row of collect(feeds.images, ['ref', 'url'])) {
      const ref = kept(row)
      const url = cleanString(field(row, 'url'))
      if (!ref || !url?.startsWith('http')) continue
      const folder = IMAGE_ROLES[url.split('/').at(-2) ?? '']
      const main = Number(field(row, 'main')) === 1 || folder === 'primary'
      // Une seule image principale par fiche : les suivantes deviennent des vues.
      const hasPrimary = index.images.get(ref)?.some((image) => image.role === 'primary')
      const role = main ? (hasPrimary ? 'view' : 'primary') : folder
      if (role) push(index.images, ref, { url, role })
    }
    for (const row of collect(feeds.markings, ['ref', 'technique_ref', 'print_area_id'])) {
      const ref = kept(row)
      const areaId = cleanString(field(row, 'print_area_id'))
      const techniqueRef = cleanString(field(row, 'technique_ref'))
      if (!ref || !areaId || !techniqueRef) continue
      push(index.markings, ref, {
        areaId,
        techniqueRef,
        maxColors: parsePositiveInt(field(row, 'max_colors')),
        widthMm: cmToMm(field(row, 'width')),
        heightMm: cmToMm(field(row, 'height')),
      })
    }
    for (const row of collect(feeds.areaLabels, ['print_area_id', 'txt'])) {
      const areaId = cleanString(field(row, 'print_area_id'))
      const label = plain(field(row, 'txt'))
      if (areaId && label) index.areaLabels.set(areaId, label)
    }
    for (const row of collect(feeds.techniqueLabels, ['technique_ref', 'name'])) {
      const techniqueRef = cleanString(field(row, 'technique_ref'))
      const label = plain(field(row, 'name'))
      if (techniqueRef && label && !index.techniqueLabels.has(techniqueRef)) {
        index.techniqueLabels.set(techniqueRef, label)
      }
    }
    for (const row of collect(feeds.techniquePrices, ['technique_ref', 'price_1'])) {
      const techniqueRef = cleanString(field(row, 'technique_ref'))
      if (!techniqueRef) continue
      const cliche = parseDecimal(field(row, 'cliche'))
      index.techniquePrices.set(techniqueRef, {
        setupCharge: cliche !== null && cliche > 0 ? cliche : null,
        tiers: sectionPriceTiers(row, 'upTo', 10),
      })
    }
    // Délais en jours, zone export (`EXP`, hors péninsule ibérique).
    for (const row of collect(feeds.leadTimes, ['material', 'printing_lead_time'])) {
      const techniqueRef = cleanString(field(row, 'material'))
      const days = parsePositiveInt(field(row, 'printing_lead_time'))
      if (!techniqueRef || days === null) continue
      if (field(row, 'zone_code') !== 'EXP' || field(row, 'unit') !== 'D') continue
      index.leadTimes.set(techniqueRef, Math.min(days, index.leadTimes.get(techniqueRef) ?? days))
    }
    return index
  }

  normalize(product: FeedNode, index: MakitoCatalogueIndex): NormalizedProduct {
    const ref = cleanString(field(product, 'ref')) ?? ''
    const sheet = index.sheets.get(ref) ?? {}
    const model = cleanString(field(product, 'name')) ?? ref
    // Le nom Makito est un nom de modèle (« Betty ») : on le préfixe du type
    // d'article (« Foulard ») pour qu'il soit lisible et classable.
    const type = cleanString(field(sheet, 'type'))
    const categories = index.categories.get(ref) ?? []
    const markings = index.markings.get(ref) ?? []
    const leadTimes = markings
      .map((marking) => index.leadTimes.get(marking.techniqueRef))
      .filter((days): days is number => days !== undefined)
    const composition = cleanString(field(sheet, 'comp'))
    const info = cleanString(field(sheet, 'info'))
    const images = [...(index.images.get(ref) ?? [])].sort(
      (a, b) => IMAGE_ORDER.indexOf(a.role) - IMAGE_ORDER.indexOf(b.role)
    )

    return {
      externalId: ref,
      name: type && !model.toLowerCase().includes(type.toLowerCase()) ? `${type} ${model}` : model,
      description: [index.descriptions.get(ref), info].filter(Boolean).join('\n\n') || null,
      keywords: index.keywords.get(ref) ?? [],
      brand: cleanString(field(product, 'brand')),
      hsCode: cleanString(field(product, 'intrastat'))?.slice(0, 10) ?? null,
      originCountry: normalizeCountry(field(product, 'country_of_origin')),
      categoryRaw: categories.join(' | ') || null,
      materialLabels: composition ? [composition] : [],
      lifecycleStatus: this.lifecycle(categories),
      leadTimeDays: leadTimes.length > 0 ? Math.min(...leadTimes) : null,
      videoUrl: null,
      currency: 'EUR',
      priceTiers: index.prices.get(ref) ?? [],
      variants: this.variants(ref, index),
      images,
      markingPositions: this.markingPositions(markings, index),
      packaging: {
        packageType: null,
        // `weight` : poids unitaire en grammes.
        unitGrossWeightG: parsePositiveInt(field(product, 'weight')),
        outerCartonQty: parsePositiveInt(field(product, 'ptc_units')),
        outerCartonLengthMm: cmToMm(field(product, 'ptc_length')),
        outerCartonWidthMm: cmToMm(field(product, 'ptc_width')),
        outerCartonHeightMm: cmToMm(field(product, 'ptc_height')),
        // Faute de frappe de l'API : `ptc_wight`.
        outerCartonGrossWeightG: kgToG(field(product, 'ptc_wight') ?? field(product, 'ptc_weight')),
      },
    }
  }

  /** Rubriques marketing Makito → cycle de vie (libellés des 4 langues importées). */
  private lifecycle(categories: string[]): NormalizedProduct['lifecycleStatus'] {
    const labels = categories.map((category) => category.toLowerCase())
    if (labels.some((label) => /d[eé]stockage|outlet|clearance|liquidaci|restposten/.test(label))) {
      return 'end_of_series'
    }
    if (labels.some((label) => /nouveaut|novedad|new products|neuheit/.test(label))) return 'new'
    return 'active'
  }

  /** Une déclinaison par `matnr` (couleur × taille) ; sans déclinaison, la fiche seule. */
  private variants(ref: string, index: MakitoCatalogueIndex): NormalizedVariant[] {
    const rows = index.variants.get(ref) ?? []
    if (rows.length === 0) {
      return [
        { sku: ref, colorLabel: null, gtin: null, stockQuantity: null, priceTiers: [], images: [] },
      ]
    }
    return rows.map((row) => {
      const sku = cleanString(field(row, 'matnr')) ?? ref
      const colorCode = cleanString(field(row, 'color'))
      const size = cleanString(field(row, 'size'))
      const color = colorCode ? (index.colors.get(colorCode) ?? colorCode) : null
      const image = cleanString(field(row, 'img100'))
      return {
        sku,
        colorLabel: [color, size === NO_SIZE ? null : size].filter(Boolean).join(' / ') || null,
        gtin: null,
        stockQuantity: index.stock.get(sku) ?? null,
        priceTiers: [],
        images: image?.startsWith('http') ? [{ url: image, role: 'view' as const }] : [],
      }
    })
  }

  /** Une zone (`print_area_id`) = une position ; ses lignes = techniques. */
  private markingPositions(
    markings: MakitoMarkingRow[],
    index: MakitoCatalogueIndex
  ): NormalizedMarkingPosition[] {
    const byArea = new Map<string, MakitoMarkingRow[]>()
    for (const marking of markings) push(byArea, marking.areaId, marking)

    return [...byArea.entries()]
      .map(([areaId, rows]) => ({
        name: index.areaLabels.get(areaId) ?? `Zone ${areaId}`,
        maxWidthMm: Math.max(0, ...rows.map((row) => row.widthMm ?? 0)) || null,
        maxHeightMm: Math.max(0, ...rows.map((row) => row.heightMm ?? 0)) || null,
        techniques: rows
          .map((row) => {
            const prices = index.techniquePrices.get(row.techniqueRef)
            return {
              label: index.techniqueLabels.get(row.techniqueRef) ?? '',
              maxColors: row.maxColors,
              setupCharge: prices?.setupCharge ?? null,
              priceTiers: prices?.tiers ?? [],
            }
          })
          .filter((technique) => technique.label !== ''),
      }))
      .filter((position) => position.techniques.length > 0)
  }
}
