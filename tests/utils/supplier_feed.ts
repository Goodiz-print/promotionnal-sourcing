import { readFileSync } from 'node:fs'
import app from '@adonisjs/core/services/app'
import supplierFeedsConfig from '#config/supplier_feeds'
import SupplierConnector from '#services/supplier_feed/supplier_connector'
import SupplierHttpClient from '#services/supplier_feed/supplier_http_client'
import ProductVariantService from '#services/product_variant_service'
import { SupplierFeedHttpException } from '#exceptions/supplier_feed_errors'
import type {
  FetchCatalogueOptions,
  NormalizedProduct,
  SupplierFeedKey,
} from '#shared/types/supplier_feed'

/** Fixture JSON anonymisée (`tests/fixtures/supplier_feed/<fournisseur>/<nom>.json`). */
export function supplierFixture(supplier: string, name: string): unknown {
  const path = app.makePath('tests', 'fixtures', 'supplier_feed', supplier, `${name}.json`)
  return JSON.parse(readFileSync(path, 'utf8'))
}

/**
 * Faux client HTTP : chaque URL est servie par la première route dont le
 * fragment y figure ; sans route, la requête échoue comme un flux injoignable.
 * Garde les URLs et en-têtes demandés pour les assertions.
 */
export class FakeSupplierHttpClient extends SupplierHttpClient {
  requests: { url: string; headers: Record<string, string> }[] = []
  /** Corps envoyés en `POST` (`postJson`), dans l'ordre. */
  posts: { url: string; body: unknown }[] = []
  /** URLs d'images demandées (`getBuffer`), dans l'ordre. */
  downloads: string[] = []

  /**
   * `files` : contenu servi par `getBuffer` pour une URL exacte ; une URL
   * absente échoue comme un flux injoignable (timeout, 5xx…).
   */
  constructor(
    private routes: Record<string, unknown>,
    public files: Record<string, { content: Buffer; mimeType: string }> = {}
  ) {
    super()
  }

  async getJson<T = unknown>(url: string, headers: Record<string, string> = {}): Promise<T> {
    this.requests.push({ url, headers })
    const fragment = Object.keys(this.routes).find((candidate) => url.includes(candidate))
    if (fragment === undefined) throw new SupplierFeedHttpException('HTTP 404 (fake)')
    return this.routes[fragment] as T
  }

  async postJson<T = unknown>(url: string, body: unknown): Promise<T> {
    this.posts.push({ url, body })
    const fragment = Object.keys(this.routes).find((candidate) => url.includes(candidate))
    if (fragment === undefined) throw new SupplierFeedHttpException('HTTP 404 (fake)')
    return this.routes[fragment] as T
  }

  async getBuffer(url: string): Promise<{ content: Buffer; mimeType: string }> {
    this.downloads.push(url)
    const file = this.files[url]
    if (!file) throw new SupplierFeedHttpException('HTTP 503 (fake)')
    return file
  }
}

/**
 * Renseigne temporairement les identifiants des connecteurs (valeurs factices) ;
 * renvoie la fonction de restauration à appeler en `cleanup`.
 */
export function withSupplierCredentials(values: {
  pfconceptFeedCode?: string | null
  passotApiKey?: string | null
  inspirionApiKey?: string | null
  makitoEmail?: string | null
  makitoPassword?: string | null
}): () => void {
  const previous = {
    feedCode: supplierFeedsConfig.pfconcept.feedCode,
    apiKey: supplierFeedsConfig.passot.apiKey,
    inspirionApiKey: supplierFeedsConfig.inspirion.apiKey,
    makitoEmail: supplierFeedsConfig.makito.email,
    makitoPassword: supplierFeedsConfig.makito.password,
  }
  if (values.inspirionApiKey !== undefined)
    supplierFeedsConfig.inspirion.apiKey = values.inspirionApiKey
  if (values.makitoEmail !== undefined) supplierFeedsConfig.makito.email = values.makitoEmail
  if (values.makitoPassword !== undefined)
    supplierFeedsConfig.makito.password = values.makitoPassword
  if (values.pfconceptFeedCode !== undefined)
    supplierFeedsConfig.pfconcept.feedCode = values.pfconceptFeedCode
  if (values.passotApiKey !== undefined) supplierFeedsConfig.passot.apiKey = values.passotApiKey
  return () => {
    supplierFeedsConfig.pfconcept.feedCode = previous.feedCode
    supplierFeedsConfig.passot.apiKey = previous.apiKey
    supplierFeedsConfig.inspirion.apiKey = previous.inspirionApiKey
    supplierFeedsConfig.makito.email = previous.makitoEmail
    supplierFeedsConfig.makito.password = previous.makitoPassword
  }
}

/** Connecteur en mémoire pour tester l'import sans réseau. */
export class InMemorySupplierConnector extends SupplierConnector {
  readonly key: SupplierFeedKey = 'pfconcept'

  readonly identity = {
    slug: 'fixture-supplier',
    name: 'Fixture Supplier',
    country: 'FR',
    website: 'https://fixture.example',
  }

  /** Flux annexes signalés indisponibles à chaque lecture. */
  missingFeeds: string[] = []

  constructor(public products: NormalizedProduct[]) {
    super()
  }

  isConfigured(): boolean {
    return true
  }

  async fetchCatalogue({
    limit,
    onMissingFeed,
  }: FetchCatalogueOptions): Promise<NormalizedProduct[]> {
    for (const feed of this.missingFeeds) onMissingFeed?.(feed)
    return this.products.slice(0, limit ?? undefined)
  }
}

/** Produit normalisé minimal, surchargé au besoin. */
export function normalizedProduct(overrides: Partial<NormalizedProduct> = {}): NormalizedProduct {
  return {
    externalId: 'EXT-1',
    name: 'Stylo bille fixture',
    description: 'Description fixture',
    keywords: ['stylo'],
    brand: null,
    hsCode: null,
    originCountry: 'FR',
    categoryRaw: 'Stylos',
    materialLabels: [],
    lifecycleStatus: 'active',
    leadTimeDays: null,
    videoUrl: null,
    currency: 'EUR',
    priceTiers: [
      { minQuantity: 100, unitPrice: 1.5 },
      { minQuantity: 500, unitPrice: 1.2 },
    ],
    variants: [
      {
        sku: 'EXT-1-BLU',
        colorLabel: 'Bleu',
        gtin: null,
        stockQuantity: 10,
        priceTiers: [],
        images: [],
      },
    ],
    images: [{ url: 'https://images.fixture.example/ext-1.jpg', role: 'primary' }],
    markingPositions: [],
    packaging: null,
    ...overrides,
  }
}

/**
 * Service de variantes dont le premier `sync` échoue sur une violation
 * d'unicité de `constraint` (comme si un import concurrent avait écrit entre
 * la lecture et l'écriture), puis délègue au vrai service.
 */
export class FailingOnceVariantService extends ProductVariantService {
  calls = 0

  constructor(private constraint: string) {
    super()
  }

  async sync(...args: Parameters<ProductVariantService['sync']>): Promise<void> {
    this.calls++
    if (this.calls === 1) {
      throw Object.assign(new Error('duplicate key value'), {
        code: '23505',
        constraint: this.constraint,
      })
    }
    return super.sync(...args)
  }
}
