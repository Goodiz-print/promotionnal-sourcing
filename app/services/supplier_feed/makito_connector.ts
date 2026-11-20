import { inject } from '@adonisjs/core'
import supplierFeedsConfig from '#config/supplier_feeds'
import SupplierConnector from '#services/supplier_feed/supplier_connector'
import SupplierHttpClient from '#services/supplier_feed/supplier_http_client'
import { field } from '#services/supplier_feed/feed_tree'
import { buildMakitoIndex, makitoProductsPage } from '#services/supplier_feed/makito_feed_index'
import { normalizeMakitoProduct } from '#services/supplier_feed/makito_feed_mapper'
import {
  SupplierConnectorNotConfiguredException,
  SupplierFeedHttpException,
  SupplierFeedIncompleteException,
} from '#exceptions/supplier_feed_errors'
import { cleanString } from '#shared/helpers/supplier_feed'
import type {
  FeedNode,
  FeedRequestContext,
  FetchCatalogueOptions,
  MakitoProductsPage,
  NormalizedProduct,
  SupplierFeedLocale,
} from '#shared/types/supplier_feed'

/** Identifiants de langue de l'API (doc v1.06, « Language IDs »). */
const LANGUAGE_IDS: Record<SupplierFeedLocale, number> = { es: 1, en: 2, fr: 4, de: 6 }

/** Produits demandés par page (`/products` est le seul flux paginé). */
const PAGE_SIZE = 1000

/**
 * Makito : API REST « Products API » v1.06 (`https://data.makito.es/api`).
 * `POST /login` (identifiants du compte client) renvoie un jeton, envoyé
 * ensuite en `Authorization: Bearer`. Seul `/products` est paginé ; tous les
 * autres flux renvoient le catalogue entier et sont joints par `ref`
 * (référence produit), `matnr` (déclinaison) ou `technique_ref` (marquage).
 *
 * L'API est lente (jusqu'à 2 min par flux) : les réponses passent par le
 * cache disque du client HTTP.
 *
 * Ce connecteur ne fait que lire les flux : l'indexation des flux annexes est
 * dans `makito_feed_index.ts`, la traduction des fiches dans
 * `makito_feed_mapper.ts` (fonctions pures, testées une à une).
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

    const perPage = Math.min(limit ?? PAGE_SIZE, PAGE_SIZE)
    const products = await this.products(limit, (page) =>
      this.http.getJson(
        `${baseUrl}/products?page=${page}&per_page=${perPage}`,
        headers,
        context.cache
      )
    )
    const refs = new Set(products.map((product) => cleanString(field(product, 'ref')) ?? ''))
    const feed = (path: string) =>
      this.optional(path, context, () =>
        this.http.getJson(`${baseUrl}/${path}`, headers, context.cache)
      )

    // Séquentiel : l'API sert mal les gros flux en parallèle.
    const index = buildMakitoIndex(refs, {
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

    return products.map((product) => normalizeMakitoProduct(product, index))
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
   * Fiches de `/products`, au plus `limit`. Un catalogue **entier** doit être
   * complet : s'il manque des fiches par rapport au `total` annoncé (page vide,
   * pagination absente), on échoue plutôt que de laisser l'importeur désactiver
   * les fiches « absentes ».
   */
  private async products(
    limit: number | null,
    fetchPage: (page: number) => Promise<unknown>
  ): Promise<FeedNode[]> {
    const { products, total } = await this.pages(limit, fetchPage, 1, [])
    if (limit !== null) return products.slice(0, limit)
    if (total === null || products.length < total) {
      throw new SupplierFeedIncompleteException(
        `Makito : catalogue incomplet (${products.length} fiche(s) reçue(s) sur ${total ?? 'un total inconnu'})`
      )
    }
    return products
  }

  /**
   * Lit `page`, puis les suivantes tant qu'il en reste : jusqu'à `limit` fiches,
   * une page vide ou la dernière page annoncée. Une page à la fois (l'API sert
   * mal les requêtes parallèles) ; le dernier `total` annoncé fait foi.
   */
  private async pages(
    limit: number | null,
    fetchPage: (page: number) => Promise<unknown>,
    page: number,
    fetched: FeedNode[]
  ): Promise<Pick<MakitoProductsPage, 'products' | 'total'>> {
    const current = makitoProductsPage(await fetchPage(page))
    const products = [...fetched, ...current.products]
    const done =
      current.products.length === 0 ||
      (limit !== null && products.length >= limit) ||
      current.lastPage === null ||
      page >= current.lastPage
    if (done) return { products, total: current.total }
    const next = await this.pages(limit, fetchPage, page + 1, products)
    return { products: next.products, total: next.total ?? current.total }
  }
}
