import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import emitter from '@adonisjs/core/services/emitter'
import logger from '@adonisjs/core/services/logger'
import stringHelpers from '@adonisjs/core/helpers/string'
import Product from '#models/product'
import ProductImage from '#models/product_image'
import ProductImageVariant from '#models/product_image_variant'
import ProductPackaging from '#models/product_packaging'
import ProductTranslation from '#models/product_translation'
import ProductChanged from '#events/product_changed'
import supplierFeedsConfig from '#config/supplier_feeds'
import ProductVariantService from '#services/product_variant_service'
import ProductMarkingService from '#services/product_marking_service'
import ProductOriginService from '#services/product_origin_service'
import ProductEcoService from '#services/product_eco_service'
import ProductStockService from '#services/product_stock_service'
import StorageService from '#services/storage/storage_service'
import SupplierHttpClient from '#services/supplier_feed/supplier_http_client'
import SupplierReferenceService from '#services/supplier_feed/supplier_reference_service'
import { SupplierFeedIncompleteException } from '#exceptions/supplier_feed_errors'
import { isEuEeaCountry } from '#shared/types/country'
import {
  firstFreeSlug,
  numberedSlugRegex,
  suffixedSlugPattern,
  truncateSlugBase,
} from '#shared/helpers/slug'
import { retryOnceOnUniqueViolation, violatedConstraint } from '#shared/helpers/database'
import type Supplier from '#models/supplier'
import type SupplierConnector from '#services/supplier_feed/supplier_connector'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ProductPriceTierInput, ProductVariantInput } from '#shared/types/product'
import type {
  ProductMarkingPositionInput,
  ProductMarkingPriceTierInput,
} from '#shared/types/marking'
import type {
  NormalizedPriceTier,
  NormalizedProduct,
  ResolvedSupplierImage,
  SupplierImportOptions,
  SupplierImportSummary,
  SupplierReferences,
} from '#shared/types/supplier_feed'

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

/** Un point d'avancement est journalisé toutes les N fiches (imports complets). */
const PROGRESS_EVERY = 500

/**
 * Contraintes d'unicité qu'un import concurrent peut heurter entre la lecture
 * et l'écriture d'une fiche (slug, couple fournisseur / code) : seules elles
 * justifient de rejouer la transaction.
 */
export const PRODUCT_IDENTITY_CONSTRAINTS = [
  'products_slug_unique',
  'products_supplier_id_external_id_unique',
] as const

function sameTiers(a: NormalizedPriceTier[], b: NormalizedPriceTier[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (tier, index) =>
        tier.minQuantity === b[index].minQuantity && tier.unitPrice === b[index].unitPrice
    )
  )
}

/**
 * Persiste un catalogue normalisé (`SupplierConnector.fetchCatalogue`) :
 * fournisseur, produits rapprochés par `(supplier_id, external_id)`, traduction
 * dans la langue du flux, facettes couleur / matière, variantes, paliers de
 * prix, marquage, conditionnement et galerie. **Une transaction par produit** :
 * une fiche invalide est comptée en échec sans bloquer les autres. Idempotent :
 * un second import met à jour, remplace prix et marquages, sans doublon.
 *
 * La réindexation Meilisearch passe par l'événement `ProductChanged` (comme une
 * saisie fournisseur), jamais par un appel direct.
 */
@inject()
export default class SupplierCatalogueImporter {
  constructor(
    protected references: SupplierReferenceService,
    protected variants: ProductVariantService,
    protected marking: ProductMarkingService,
    protected origin: ProductOriginService,
    protected eco: ProductEcoService,
    protected stock: ProductStockService,
    protected storage: StorageService,
    protected http: SupplierHttpClient
  ) {}

  async import(
    connector: SupplierConnector,
    options: SupplierImportOptions
  ): Promise<SupplierImportSummary> {
    const missingFeeds = new Set<string>()
    const products = await connector.fetchCatalogue({
      limit: options.limit,
      locale: options.locale,
      refresh: options.refresh,
      onMissingFeed: (feed) => missingFeeds.add(feed),
    })
    const summary: SupplierImportSummary = {
      supplier: connector.key,
      fetched: products.length,
      created: 0,
      updated: 0,
      failed: 0,
      deactivated: 0,
      deactivationSkipped: 0,
      unmatchedCategories: [],
      unmatchedTechniques: [],
      missingFeeds: [...missingFeeds].sort(),
      errors: [],
    }

    // En dry-run, rien n'est écrit : la catégorie de repli n'est pas créée.
    const refs = await this.references.load({ createFallback: !options.dryRun })
    summary.unmatchedCategories = this.unmatchedCategories(products, refs)
    summary.unmatchedTechniques = this.unmatchedTechniques(products, refs)

    if (options.dryRun) return summary

    // Import intégral amputé d'un flux annexe : l'écrire remplacerait prix,
    // déclinaisons ou marquages existants par du vide sur tout le catalogue.
    if (options.limit === null && summary.missingFeeds.length > 0) {
      throw new SupplierFeedIncompleteException(
        `Import intégral annulé, flux indisponible(s) : ${summary.missingFeeds.join(', ')}`
      )
    }

    const supplier = await this.references.upsertSupplier(connector.identity, options.locale)
    for (const [index, product] of products.entries()) {
      if (index > 0 && index % PROGRESS_EVERY === 0) {
        logger.info(
          { supplier: connector.key, done: index, total: products.length, failed: summary.failed },
          'supplier import progress'
        )
      }
      try {
        const created = await this.persist(
          supplier,
          connector.identity.slug,
          product,
          refs,
          options
        )
        if (created) summary.created++
        else summary.updated++
      } catch (error) {
        summary.failed++
        const message = error instanceof Error ? error.message : String(error)
        summary.errors.push({ externalId: product.externalId, message })
        logger.warn(
          { supplier: connector.key, externalId: product.externalId, err: error },
          'supplier product import failed'
        )
      }
    }
    const missing = await this.missingProducts(supplier, products, options.limit)
    const { ratio, minimum } = supplierFeedsConfig.massDeactivation
    if (
      !options.allowMassDeactivation &&
      missing.products.length > minimum &&
      missing.products.length > missing.active * ratio
    ) {
      // Aucun flux n'annonce son total (sauf Makito) : un JSON valide mais
      // amputé ferait désactiver des fiches toujours vendues.
      summary.deactivationSkipped = missing.products.length
      logger.warn(
        { supplier: connector.key, missing: missing.products.length, active: missing.active },
        'supplier import: mass deactivation skipped, feed looks truncated'
      )
      return summary
    }
    await this.deactivate(missing.products.map((product) => product.id))
    summary.deactivated = missing.products.length
    return summary
  }

  /** Catégories fournisseur (ou noms de fiche) tombées dans « Non classé », triées. */
  private unmatchedCategories(products: NormalizedProduct[], refs: SupplierReferences): string[] {
    const labels = products
      .filter((product) => this.categoryFor(product, refs) === refs.fallbackCategoryId)
      .map((product) => product.categoryRaw ?? product.name)
    return [...new Set(labels)].sort()
  }

  /**
   * Libellés de technique de marquage sans correspondance, triés. Dédoublonnés
   * avant le rapprochement : chaque libellé n'est rapproché qu'une fois.
   */
  private unmatchedTechniques(products: NormalizedProduct[], refs: SupplierReferences): string[] {
    const labels = products
      .flatMap((product) => product.markingPositions)
      .flatMap((position) => position.techniques)
      .map((technique) => technique.label)
    return [...new Set(labels)].filter((label) => refs.techniques.match(label) === null).sort()
  }

  /**
   * Dépublie les fiches en **une requête** (tableau passé en un seul paramètre :
   * pas de limite de paramètres PostgreSQL), puis met en queue leur
   * réindexation.
   */
  private async deactivate(productIds: number[]): Promise<void> {
    if (productIds.length === 0) return
    await Product.query()
      .whereRaw('id = ANY(?)', [productIds])
      .update({ isActive: false, updatedAt: DateTime.now() })
    await Promise.all(productIds.map((id) => emitter.emit(ProductChanged, new ProductChanged(id))))
  }

  /**
   * Fiches actives du fournisseur **absentes du flux**, à désactiver, et nombre
   * de fiches actives. Vide si le flux n'est pas complet : il l'est sans limite
   * (`--full`), ou avec moins de `limit` produits récupérés (les connecteurs
   * tronquent à `limit`) ; à `limit` pile il peut être tronqué. Un flux vide
   * est traité comme une panne fournisseur. Les fiches en échec d'import
   * restent dans le flux : elles ne sont pas désactivées.
   */
  private async missingProducts(
    supplier: Supplier,
    products: NormalizedProduct[],
    limit: number | null
  ): Promise<{ products: Product[]; active: number }> {
    if (products.length === 0 || (limit !== null && products.length >= limit)) {
      return { products: [], active: 0 }
    }
    // Filtrage en mémoire : un `NOT IN` de tout le catalogue dépasserait la
    // limite de paramètres de PostgreSQL (65 535) sur un gros fournisseur.
    const present = new Set(products.map((product) => product.externalId))
    const active = await Product.query()
      .select('id', 'externalId')
      .where('supplierId', supplier.id)
      .whereNotNull('externalId')
      .where('isActive', true)
    return {
      products: active.filter((product) => !present.has(product.externalId!)),
      active: active.length,
    }
  }

  /**
   * Catégorie la mieux couverte par la catégorie fournisseur **et** le nom du
   * produit ; sinon la catégorie de repli « Non classé ».
   */
  categoryFor(product: NormalizedProduct, refs: SupplierReferences): number {
    const text = [product.categoryRaw, product.name].filter(Boolean).join(' ')
    return refs.categories.best(text) ?? refs.fallbackCategoryId
  }

  /** Persiste une fiche ; `true` si elle vient d'être créée. */
  private async persist(
    supplier: Supplier,
    supplierSlug: string,
    normalized: NormalizedProduct,
    refs: SupplierReferences,
    options: SupplierImportOptions
  ): Promise<boolean> {
    // Téléchargements hors transaction (réseau lent) ; libérés si l'écriture échoue.
    // `null` = galerie laissée telle quelle (`--skip-images` ou téléchargement en échec).
    const images = options.skipImages
      ? null
      : await this.resolveImages(supplier, normalized, options.storeImages)
    const storedIds = (images ?? [])
      .map((image) => image.storageObjectId)
      .filter((id): id is number => id !== null)

    let result: { productId: number; created: boolean; tombstones: Array<number | null> }
    const writeOnce = () =>
      db.transaction((trx) =>
        this.write(trx, supplier, supplierSlug, normalized, refs, options, images)
      )
    try {
      // Un import concurrent a pu prendre le même slug (ou créer la même fiche)
      // entre la lecture et l'écriture : le nouvel essai relit l'état validé.
      // Les autres violations (SKU en double…) échoueraient de nouveau : propagées.
      result = await retryOnceOnUniqueViolation(writeOnce, PRODUCT_IDENTITY_CONSTRAINTS, (error) =>
        logger.warn(
          {
            supplier: supplierSlug,
            externalId: normalized.externalId,
            constraint: violatedConstraint(error),
          },
          'supplier:import — violation d’unicité concurrente, transaction de la fiche rejouée'
        )
      )
    } catch (error) {
      await this.storage.discard(storedIds)
      throw error
    }

    await this.storage.dispatchDeletions(result.tombstones)
    await emitter.emit(ProductChanged, new ProductChanged(result.productId))
    return result.created
  }

  private async write(
    trx: TransactionClientContract,
    supplier: Supplier,
    supplierSlug: string,
    normalized: NormalizedProduct,
    refs: SupplierReferences,
    options: SupplierImportOptions,
    images: ResolvedSupplierImage[] | null
  ): Promise<{ productId: number; created: boolean; tombstones: Array<number | null> }> {
    const existing = await Product.query({ client: trx })
      .where('supplierId', supplier.id)
      .where('externalId', normalized.externalId)
      .forUpdate()
      .first()

    const originCountry = normalized.originCountry
    const madeInEurope = originCountry !== null && isEuEeaCountry(originCountry)
    const columns = {
      supplierId: supplier.id,
      externalId: normalized.externalId,
      categoryId: this.categoryFor(normalized, refs),
      reference: normalized.externalId,
      currency: normalized.currency,
      minQuantity: normalized.priceTiers[0]?.minQuantity ?? null,
      brand: normalized.brand,
      hsCode: normalized.hsCode,
      originCountry,
      madeInEurope,
      originZone: this.origin.deriveZone(originCountry, madeInEurope),
      lifecycleStatus: normalized.lifecycleStatus,
      supplierCategoryRaw: normalized.categoryRaw?.slice(0, 255) ?? null,
      leadTimeDays: normalized.leadTimeDays,
      videoUrl: normalized.videoUrl,
      // `isActive` n'est posé qu'à la création : une fiche désactivée (admin,
      // fournisseur ou absente d'un flux complet) n'est jamais republiée par un import.
      isConfigurable: normalized.variants.length > 1,
      printable: normalized.markingPositions.length > 0,
      sourceLocale: options.locale,
    }

    let product: Product
    if (existing) {
      product = existing.merge(columns)
      await product.save()
    } else {
      const slug = await this.uniqueSlug(
        trx,
        truncateSlugBase(
          `${supplierSlug}-${stringHelpers.slug(normalized.externalId, { lower: true })}`
        )
      )
      product = await Product.create(
        {
          ...columns,
          slug,
          isActive: true,
          releasedAt: normalized.lifecycleStatus === 'new' ? DateTime.now() : null,
        },
        { client: trx }
      )
    }

    await ProductTranslation.updateOrCreate(
      { productId: product.id, locale: options.locale },
      {
        name: normalized.name.slice(0, 255),
        description: normalized.description,
        keywords: normalized.keywords.length > 0 ? normalized.keywords : null,
        isAuto: false,
      },
      { client: trx }
    )

    // Facettes : couleurs des variantes (nuance + famille) et matières.
    // Une nuance reconnue entraîne sa famille (attributs distincts `color-shade` / `color`).
    const colorBySku = new Map<string, number[]>()
    const facetIds = new Set<number>()
    for (const variant of normalized.variants) {
      const colorId = refs.colors.match(variant.colorLabel)
      if (colorId === null) continue
      const parent = refs.values.get(colorId)?.parentValueId
      const ids = parent ? [colorId, parent] : [colorId]
      colorBySku.set(variant.sku, ids)
      for (const id of ids) facetIds.add(id)
    }
    const materialIds = normalized.materialLabels.flatMap((label) => refs.materials.matchAll(label))
    for (const id of materialIds) facetIds.add(id)
    const pivot: Record<number, { attribute_id: number }> = {}
    for (const id of facetIds) {
      const value = refs.values.get(id)
      if (value) pivot[id] = { attribute_id: value.attributeId }
    }
    await product.related('attributeValues').sync(pivot, true, trx)

    const tombstones = images === null ? [] : await this.syncImages(trx, product, images)

    const variantInputs = this.variantInputs(normalized, colorBySku)
    await this.variants.sync(
      trx,
      product,
      variantInputs,
      this.priceTierInputs(normalized, variantInputs)
    )

    const { positions, tiers } = this.markingInputs(normalized, refs)
    await this.marking.sync(trx, product, positions, tiers)

    await this.syncPackaging(trx, product, normalized)

    product.stockStatus = this.stock.deriveStatus(
      variantInputs.map((input) => ({ isActive: true, stockStatus: input.stockStatus ?? null }))
    )
    // Les labels éco sont saisis hors flux (back-office) : on en tient compte
    // pour ne pas écraser `is_eco` à chaque import.
    const ecoCertification = existing
      ? await product.related('certifications').query().where('is_eco', true).first()
      : null
    product.isEco = this.eco.deriveIsEco({
      recycledContentPercent: product.recycledContentPercent,
      materialSlugs: materialIds.map((id) => refs.values.get(id)?.slug ?? ''),
      hasEcoCertification: ecoCertification !== null,
    })
    await product.save()

    return { productId: product.id, created: !existing, tombstones }
  }

  /**
   * Slug libre, suffixé `-2`, `-3`… au besoin : deux codes fournisseur peuvent
   * donner le même slug (`AB 12` / `AB-12`) ou heurter une fiche existante.
   */
  private async uniqueSlug(trx: TransactionClientContract, base: string): Promise<string> {
    // Une seule lecture, quel que soit le nombre de collisions (issue #248) :
    // le suffixe libre se calcule en mémoire.
    // Le `LIKE` par préfixe est servi par `products_slug_pattern_index` ; la
    // regex ne garde que les suffixes numériques (pas les codes voisins).
    const taken = await Product.query({ client: trx })
      .where((query) => {
        query.where('slug', base).orWhere((suffixed) => {
          suffixed
            .whereLike('slug', suffixedSlugPattern(base))
            .whereRaw('slug ~ ?', [numberedSlugRegex(base)])
        })
      })
      .select('slug')
      .pojo<{ slug: string }>()
    return firstFreeSlug(
      base,
      taken.map((row) => row.slug)
    )
  }

  private variantInputs(
    normalized: NormalizedProduct,
    colorBySku: Map<string, number[]>
  ): ProductVariantInput[] {
    const seen = new Set<string>()
    return normalized.variants
      .filter((variant) => variant.sku !== '' && !seen.has(variant.sku) && seen.add(variant.sku))
      .map((variant) => {
        const colorIds = colorBySku.get(variant.sku) ?? []
        const quantity = variant.stockQuantity
        return {
          sku: variant.sku.slice(0, 100),
          isActive: true,
          gtin: variant.gtin?.slice(0, 14) ?? null,
          stockQuantity: quantity === null ? null : Math.round(quantity),
          stockStatus: quantity === null ? null : quantity > 0 ? 'in_stock' : 'out_of_stock',
          attributeValueIds: colorIds,
        }
      })
  }

  /** Paliers du produit + paliers propres aux variantes dont la grille diffère. */
  private priceTierInputs(
    normalized: NormalizedProduct,
    variants: ProductVariantInput[]
  ): ProductPriceTierInput[] {
    const kept = new Set(variants.map((variant) => variant.sku))
    const tiers: ProductPriceTierInput[] = normalized.priceTiers.map((tier) => ({
      minQuantity: tier.minQuantity,
      unitPrice: tier.unitPrice,
    }))
    for (const variant of normalized.variants) {
      if (!kept.has(variant.sku) || variant.priceTiers.length === 0) continue
      if (sameTiers(variant.priceTiers, normalized.priceTiers)) continue
      kept.delete(variant.sku)
      for (const tier of variant.priceTiers) {
        tiers.push({
          variantSku: variant.sku,
          minQuantity: tier.minQuantity,
          unitPrice: tier.unitPrice,
        })
      }
    }
    return tiers
  }

  /**
   * Positions et grille de marquage. Une technique non reconnue est ignorée
   * (signalée dans le bilan) ; la grille est par technique, la première
   * position qui la propose fait foi.
   */
  private markingInputs(
    normalized: NormalizedProduct,
    refs: SupplierReferences
  ): { positions: ProductMarkingPositionInput[]; tiers: ProductMarkingPriceTierInput[] } {
    const pricedTechniques = new Set<number>()
    const tiers: ProductMarkingPriceTierInput[] = []
    const positions = normalized.markingPositions.map((position) => {
      const seen = new Set<number>()
      const techniques = position.techniques.flatMap((technique) => {
        const id = refs.techniques.match(technique.label)
        if (id === null || seen.has(id)) return []
        seen.add(id)
        if (!pricedTechniques.has(id)) {
          pricedTechniques.add(id)
          const quantities = new Set<number>()
          for (const tier of technique.priceTiers) {
            if (quantities.has(tier.minQuantity)) continue
            quantities.add(tier.minQuantity)
            tiers.push({
              markingTechniqueId: id,
              minQuantity: tier.minQuantity,
              unitPrice: tier.unitPrice,
            })
          }
        }
        return [
          {
            markingTechniqueId: id,
            maxColors: technique.maxColors,
            defaultSetupCharge: technique.setupCharge,
          },
        ]
      })
      return {
        name: position.name.slice(0, 255),
        maxWidthMm: position.maxWidthMm,
        maxHeightMm: position.maxHeightMm,
        techniques,
      }
    })
    return { positions, tiers }
  }

  private async syncPackaging(
    trx: TransactionClientContract,
    product: Product,
    normalized: NormalizedProduct
  ): Promise<void> {
    const packaging = normalized.packaging
    if (!packaging || Object.values(packaging).every((value) => value === null)) return
    await ProductPackaging.updateOrCreate(
      { productId: product.id },
      {
        packageType: packaging.packageType?.slice(0, 100) ?? null,
        unitGrossWeightG: packaging.unitGrossWeightG,
        outerCartonQty: packaging.outerCartonQty,
        outerCartonLengthMm: packaging.outerCartonLengthMm,
        outerCartonWidthMm: packaging.outerCartonWidthMm,
        outerCartonHeightMm: packaging.outerCartonHeightMm,
        outerCartonGrossWeightG: packaging.outerCartonGrossWeightG,
      },
      { client: trx }
    )
  }

  /**
   * Images retenues (galerie puis images de variantes, dédoublonnées), au plus
   * `maxImagesPerProduct`. Avec `storeImages`, chacune est copiée dans Cellar
   * (clé sha256, dédoublonnage), sauf si elle l'a déjà été pour cette fiche
   * (même URL source) : elle est alors réutilisée **sans re-téléchargement**.
   *
   * Un téléchargement en échec (timeout, 5xx) renvoie `null` : la galerie
   * existante est laissée intacte (le prochain import réessaiera) plutôt que
   * remplacée par une galerie amputée. Une réponse qui n'est pas une image
   * (échec déterministe) est seulement écartée.
   */
  private async resolveImages(
    supplier: Supplier,
    normalized: NormalizedProduct,
    storeImages: boolean
  ): Promise<ResolvedSupplierImage[] | null> {
    const seen = new Set<string>()
    const candidates = [
      ...normalized.images,
      ...normalized.variants.flatMap((variant) => variant.images),
    ]
      .filter((image) => !seen.has(image.url) && seen.add(image.url))
      .slice(0, supplierFeedsConfig.maxImagesPerProduct)

    if (!storeImages) {
      return candidates.map((image) => ({
        url: image.url,
        sourceUrl: image.url,
        role: image.role,
        storageObjectId: null,
      }))
    }

    const alreadyStored = await this.storedImages(supplier, normalized.externalId)
    const resolved: ResolvedSupplierImage[] = []
    const fresh: number[] = []
    try {
      for (const image of candidates) {
        const known = alreadyStored.get(image.url)
        if (known) {
          resolved.push({ ...known, sourceUrl: image.url, role: image.role })
          continue
        }
        let download: { content: Buffer; mimeType: string }
        try {
          download = await this.http.getBuffer(image.url)
        } catch (error) {
          logger.warn(
            { err: error, externalId: normalized.externalId },
            'supplier image download failed, gallery left untouched'
          )
          await this.storage.discard(fresh)
          return null
        }
        const type = download.mimeType.split(';')[0].trim()
        const extension = IMAGE_EXTENSIONS[type]
        if (!extension) continue
        const object = await this.storage.storeContent(download.content, extension, type)
        fresh.push(object.id)
        resolved.push({
          url: this.storage.urlFor(object),
          sourceUrl: image.url,
          role: image.role,
          storageObjectId: object.id,
        })
      }
    } catch (error) {
      await this.storage.discard(fresh)
      throw error
    }
    return resolved
  }

  /** Images de la fiche déjà copiées dans Cellar, par URL source. */
  private async storedImages(
    supplier: Supplier,
    externalId: string
  ): Promise<Map<string, { url: string; storageObjectId: number }>> {
    const rows = await ProductImage.query()
      .select('sourceUrl', 'secureUrl', 'storageObjectId')
      .whereNotNull('sourceUrl')
      .whereNotNull('storageObjectId')
      .whereHas('product', (query) =>
        query.where('supplierId', supplier.id).where('externalId', externalId)
      )
    const stored = new Map<string, { url: string; storageObjectId: number }>()
    for (const row of rows) {
      if (row.sourceUrl && row.storageObjectId) {
        stored.set(row.sourceUrl, { url: row.secureUrl, storageObjectId: row.storageObjectId })
      }
    }
    return stored
  }

  /**
   * Galerie : inchangée si les mêmes images (URL source + objet Cellar)
   * reviennent dans le même ordre (seuls rôle et URL source sont recalés) ;
   * sinon remplacée. Les nouvelles lignes sont écrites **avant** la libération des anciens objets, pour qu'un objet
   * dédoublonné encore référencé ne soit jamais libéré. Renvoie les pierres
   * tombales à purger après le commit.
   */
  private async syncImages(
    trx: TransactionClientContract,
    product: Product,
    images: ResolvedSupplierImage[]
  ): Promise<Array<number | null>> {
    const current = await ProductImage.query({ client: trx })
      .where('productId', product.id)
      .orderBy('position')
    // Comparaison par URL source (repli sur `secure_url` pour les lignes
    // antérieures à `source_url`) et par objet Cellar.
    const unchanged =
      current.length === images.length &&
      current.every(
        (image, index) =>
          (image.sourceUrl ?? image.secureUrl) === images[index].sourceUrl &&
          image.storageObjectId === images[index].storageObjectId
      )

    if (unchanged) {
      for (const [index, image] of current.entries()) {
        const { role, sourceUrl } = images[index]
        if (image.role === role && image.sourceUrl === sourceUrl) continue
        await image.useTransaction(trx).merge({ role, sourceUrl }).save()
      }
      product.imageUrl = images[0]?.url ?? null
      return []
    }

    const derived = current.length
      ? await ProductImageVariant.query({ client: trx }).whereIn(
          'productImageId',
          current.map((image) => image.id)
        )
      : []
    const released = [
      ...current.map((image) => image.storageObjectId),
      ...derived.map((variant) => variant.storageObjectId),
    ].filter((id): id is number => id !== null)

    if (current.length > 0) {
      // Variantes d'image en cascade ; `product_variants.image_id` repasse à NULL.
      await ProductImage.query({ client: trx }).where('productId', product.id).delete()
    }
    if (images.length > 0) {
      await ProductImage.createMany(
        images.map((image, position) => ({
          productId: product.id,
          secureUrl: image.url,
          sourceUrl: image.sourceUrl,
          storageObjectId: image.storageObjectId,
          role: image.role,
          position,
        })),
        { client: trx }
      )
    }
    product.imageUrl = images[0]?.url ?? null

    const tombstones: Array<number | null> = []
    for (const id of released) tombstones.push(await this.storage.release(trx, id))
    return tombstones
  }
}
