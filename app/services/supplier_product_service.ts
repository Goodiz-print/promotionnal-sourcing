import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import stringHelpers from '@adonisjs/core/helpers/string'
import Product from '#models/product'
import Supplier from '#models/supplier'
import Category from '#models/category'
import Attribute from '#models/attribute'
import AttributeValue from '#models/attribute_value'
import Certification from '#models/certification'
import ProductPackaging from '#models/product_packaging'
import ProductImage from '#models/product_image'
import ProductImageVariant from '#models/product_image_variant'
import ProductVariantService from '#services/product_variant_service'
import ProductOriginService from '#services/product_origin_service'
import ProductEcoService from '#services/product_eco_service'
import ProductTranslation from '#models/product_translation'
import SupplierTranslation from '#models/supplier_translation'
import StorageService from '#services/storage/storage_service'
import TranslationQueueService from '#services/translation_queue_service'
import { missingSourceTranslation } from '#exceptions/translation_errors'
import GenerateImageVariantsJob from '#jobs/generate_image_variants_job'
import logger from '@adonisjs/core/services/logger'
import emitter from '@adonisjs/core/services/emitter'
import ProductChanged from '#events/product_changed'
import { CONTENT_LOCALES, type ContentLocale } from '#shared/types/i18n'
import { MATERIAL_ATTRIBUTE_SLUG } from '#shared/types/certification'
import type Organization from '#models/organization'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type {
  ProductPackagingInput,
  SupplierProductInput,
  SupplierProductUpdateInput,
} from '#shared/types/product'

/**
 * Gestion des produits côté fournisseur (CRUD + galerie Cellar). Toute la
 * logique ORM vit ici (controllers fins). `StorageService` est injecté pour la
 * testabilité (les tests remplacent `StorageDriver`, aucun appel réseau).
 */
@inject()
export default class SupplierProductService {
  constructor(
    private storage: StorageService,
    private translationQueue: TranslationQueueService,
    private variants: ProductVariantService,
    private origin: ProductOriginService,
    private eco: ProductEcoService
  ) {}

  /**
   * Résout le fournisseur (fiche catalogue) de l'organisation. Le crée si l'org
   * n'en a pas encore (nom = nom de l'org, slug dérivé, pays de l'org).
   */
  async resolveSupplier(org: Organization): Promise<Supplier> {
    const existing = await Supplier.query().where('organizationId', org.id).orderBy('id').first()
    if (existing) return existing

    const slug = await this.uniqueSlug(org.name, async (s) => !!(await Supplier.findBy('slug', s)))
    const supplier = await Supplier.create({
      slug,
      country: org.country ?? 'FR',
      isActive: true,
      organizationId: org.id,
    })
    for (const locale of CONTENT_LOCALES) {
      await SupplierTranslation.updateOrCreate(
        { supplierId: supplier.id, locale },
        { name: org.name, description: null }
      )
    }
    return supplier
  }

  /**
   * Produits gérés par l'org (via ses fournisseurs), avec traductions + galerie.
   */
  listForOrg(org: Organization): Promise<Product[]> {
    return Product.query()
      .whereHas('supplier', (supplier) => supplier.where('organizationId', org.id))
      .preload('translations')
      .preload('images', (images) => images.orderBy('position').preload('variants'))
      .orderBy('slug')
  }

  /**
   * Produit possédé par l'org (ownership garanti via le fournisseur), avec tout
   * le nécessaire à l'édition. `null` si introuvable ou hors de l'org.
   */
  findOwned(org: Organization, productId: number): Promise<Product | null> {
    return (
      Product.query()
        .where('id', productId)
        .whereHas('supplier', (supplier) => supplier.where('organizationId', org.id))
        .preload('translations')
        .preload('images', (images) => images.orderBy('position').preload('variants'))
        .preload('attributeValues')
        .preload('certifications')
        .preload('variants', (variants) => variants.preload('attributes').orderBy('id'))
        .preload('priceTiers', (tiers) => tiers.orderBy('minQuantity'))
        .preload('documents', (documents) =>
          documents.whereNotNull('storageObjectId').preload('storageObject').orderBy('id')
        )
        // Conditionnement / logistique (écart 3) : relation 1:1.
        .preload('packaging')
        .first()
    )
  }

  /**
   * Crée un produit pour l'org (get-or-create du fournisseur), avec traductions,
   * facettes et galerie.
   */
  async create(
    org: Organization,
    data: SupplierProductInput,
    files: MultipartFile[]
  ): Promise<Product> {
    const source = data.translations[data.sourceLocale]
    if (!source) throw missingSourceTranslation(data.sourceLocale)

    const supplier = await this.resolveSupplier(org)
    const slug = await this.uniqueSlug(
      source.name,
      async (s) => !!(await Product.findBy('slug', s))
    )

    // Produit + variantes + paliers dans une même transaction : une variante
    // invalide n'abandonne pas un produit à moitié créé.
    const product = await db.transaction(async (trx) => {
      const created = await Product.create(
        {
          supplierId: supplier.id,
          slug,
          sourceLocale: data.sourceLocale,
          ...this.toColumns(data),
          // Explicite : sans cela, `product.isActive` resterait indéfini après l'insert.
          isActive: data.isActive ?? true,
          // Zone de provenance dérivée (écart 9) — jamais saisie.
          originZone: this.origin.deriveZone(
            data.originCountry ?? null,
            data.madeInEurope ?? false
          ),
        },
        { client: trx }
      )
      await this.variants.sync(trx, created, data.variants, data.priceTiers)
      // Conditionnement (écart 3) dans la même transaction que le save produit.
      await this.syncPackaging(trx, created, data.packaging)
      return created
    })

    await this.writeTranslations(product, data.translations)
    await this.syncFacets(product, data.attributeValueIds)
    await this.syncCertifications(product, data.certificationIds)
    // Dérive « Éco-responsable » (écart 4) sur l'état effectif : facettes +
    // labels synchronisés, part de recyclé déjà sur `product`.
    await this.refreshIsEco(product)
    await this.attachImages(product, files, 0)
    await this.refreshPrimaryImage(product)
    await emitter.emit(ProductChanged, new ProductChanged(product.id))
    if (product.isActive) {
      await this.translationQueue.queue('product', product.id, data.sourceLocale)
    }

    return product
  }

  /**
   * Met à jour un produit. **Partiel** : seuls les champs fournis sont modifiés
   * (une seule langue peut être corrigée sans renvoyer le produit ; facettes
   * conservées si `attributeValueIds` est absent). Galerie : suppression des
   * images retirées + ajout des nouvelles.
   */
  async update(
    product: Product,
    data: SupplierProductUpdateInput,
    files: MultipartFile[],
    removedImageIds: number[] = []
  ): Promise<Product> {
    const sourceLocale = (data.sourceLocale ?? product.sourceLocale) as ContentLocale
    await this.assertSourceExists(product, sourceLocale, data.translations?.[sourceLocale])

    await db.transaction(async (trx) => {
      product.useTransaction(trx)
      product.merge({ ...this.toColumns(data), sourceLocale })
      // Recalcule la zone dérivée (écart 9) sur les valeurs effectives après merge :
      // un changement de pays OU du drapeau « made in Europe » la met à jour.
      product.originZone = this.origin.deriveZone(product.originCountry, product.madeInEurope)
      await product.save()
      await this.variants.sync(trx, product, data.variants, data.priceTiers)
      // Conditionnement (écart 3) dans la même transaction que le save produit.
      await this.syncPackaging(trx, product, data.packaging)
    })
    await this.writeTranslations(product, data.translations)
    if (data.attributeValueIds !== undefined) await this.syncFacets(product, data.attributeValueIds)
    if (data.certificationIds !== undefined)
      await this.syncCertifications(product, data.certificationIds)
    // Recalcule « Éco-responsable » (écart 4) : la part de recyclé, les matières
    // ou les labels ont pu changer.
    await this.refreshIsEco(product)

    await this.removeImages(product, removedImageIds)

    const last = await product.related('images').query().orderBy('position', 'desc').first()
    await this.attachImages(product, files, last ? last.position + 1 : 0)
    await this.refreshPrimaryImage(product)
    await emitter.emit(ProductChanged, new ProductChanged(product.id))
    if (product.isActive) await this.translationQueue.queue('product', product.id, sourceLocale)

    return product
  }

  /**
   * Supprime un produit. Les lignes filles (translations, images, facettes)
   * partent en cascade DB ; les objets de la galerie qui ne sont plus utilisés
   * reçoivent leur ligne `pending_delete` dans la même transaction.
   */
  async delete(product: Product): Promise<void> {
    const images = await product.related('images').query()
    const objectIds = await this.galleryObjectIds(images)

    const tombstones = await db.transaction(async (trx) => {
      await Product.query({ client: trx }).where('id', product.id).delete()
      const ids: Array<number | null> = []
      for (const objectId of objectIds) ids.push(await this.storage.release(trx, objectId))
      return ids
    })

    await this.storage.dispatchDeletions(tombstones)
    // Le produit n'existe plus : la synchronisation le retire de l'index.
    await emitter.emit(ProductChanged, new ProductChanged(product.id))
  }

  /**
   * Retire des images de la galerie : suppression des lignes et écriture des
   * `pending_delete` des objets devenus inutiles, dans une même transaction.
   */
  private async removeImages(product: Product, imageIds: number[]): Promise<void> {
    if (imageIds.length === 0) return

    const removed = await ProductImage.query()
      .whereIn('id', imageIds)
      .where('productId', product.id)
    const objectIds = await this.galleryObjectIds(removed)

    const tombstones = await db.transaction(async (trx) => {
      await ProductImage.query({ client: trx })
        .whereIn(
          'id',
          removed.map((image) => image.id)
        )
        .delete()
      const ids: Array<number | null> = []
      for (const objectId of objectIds) ids.push(await this.storage.release(trx, objectId))
      return ids
    })

    await this.storage.dispatchDeletions(tombstones)
  }

  /**
   * Objets Cellar portés par ces images : l'original **et** ses variantes
   * (les lignes variantes partent en cascade avec l'image, leurs objets doivent
   * être libérés dans la même transaction).
   */
  private async galleryObjectIds(images: ProductImage[]): Promise<number[]> {
    const variants = await ProductImageVariant.query().whereIn(
      'productImageId',
      images.map((image) => image.id)
    )
    const ids = [
      ...images.map((image) => image.storageObjectId),
      ...variants.map((variant) => variant.storageObjectId),
    ]
    return ids.filter((id): id is number => id !== null)
  }

  /**
   * Planifie la génération des variantes (carte, fiche, zoom) des images. Un
   * échec de queue n'est pas fatal : l'original reste servi.
   */
  private async queueVariants(images: ProductImage[]): Promise<void> {
    for (const image of images) {
      try {
        await GenerateImageVariantsJob.dispatch({ productImageId: image.id })
      } catch (error) {
        logger.warn({ err: error, productImageId: image.id }, 'failed to queue image variants')
      }
    }
  }

  /**
   * Toutes les catégories (pour le select du formulaire — pas seulement celles
   * ayant déjà un produit, contrairement au catalogue public).
   */
  allCategories(): Promise<Category[]> {
    return Category.query().preload('translations').orderBy('slug')
  }

  /**
   * Référentiel des labels de conformité (écart 4) avec leurs traductions, pour
   * la sélection dans le formulaire fournisseur.
   */
  allCertifications(): Promise<Certification[]> {
    return Certification.query().preload('translations').orderBy('slug')
  }

  /**
   * Attributs filtrables + valeurs (facettes éditables dans le formulaire).
   */
  filterableAttributes(): Promise<Attribute[]> {
    return Attribute.query()
      .where('isFilterable', true)
      .preload('translations')
      .preload('values', (values) => values.preload('translations').orderBy('slug'))
      .orderBy('slug')
  }

  /**
   * Colonnes neutres du produit dérivées du payload (décimaux en string Lucid).
   * Création : défauts appliqués. Mise à jour : seules les clés présentes sont
   * retournées (`undefined` = ne pas toucher).
   */
  private toColumns(data: SupplierProductUpdateInput) {
    const columns: Partial<
      Pick<
        Product,
        | 'categoryId'
        | 'priceMin'
        | 'priceMax'
        | 'currency'
        | 'minQuantity'
        | 'originCountry'
        | 'madeInEurope'
        | 'isActive'
        | 'brand'
        | 'hsCode'
        | 'isConfigurable'
        | 'lifecycleStatus'
        | 'releasedAt'
        | 'supplierCategoryRaw'
        | 'leadTimeDays'
        | 'rushService'
        | 'rushLeadTimeDays'
        | 'videoUrl'
        | 'recycledContentPercent'
        | 'cautionComment'
      >
    > = {}
    const decimal = (value: number | null) => (typeof value === 'number' ? String(value) : null)

    if (data.categoryId !== undefined) columns.categoryId = data.categoryId
    if (data.priceMin !== undefined) columns.priceMin = decimal(data.priceMin)
    if (data.priceMax !== undefined) columns.priceMax = decimal(data.priceMax)
    if (data.currency !== undefined) columns.currency = data.currency
    if (data.minQuantity !== undefined) columns.minQuantity = data.minQuantity
    if (data.originCountry !== undefined) columns.originCountry = data.originCountry
    if (data.madeInEurope !== undefined) columns.madeInEurope = data.madeInEurope
    if (data.isActive !== undefined) columns.isActive = data.isActive

    // Identité / classification (écart 5).
    if (data.brand !== undefined) columns.brand = data.brand
    if (data.hsCode !== undefined) columns.hsCode = data.hsCode
    if (data.isConfigurable !== undefined) columns.isConfigurable = data.isConfigurable
    if (data.lifecycleStatus !== undefined) columns.lifecycleStatus = data.lifecycleStatus
    if (data.releasedAt !== undefined) {
      columns.releasedAt = data.releasedAt ? DateTime.fromISO(data.releasedAt) : null
    }
    if (data.supplierCategoryRaw !== undefined)
      columns.supplierCategoryRaw = data.supplierCategoryRaw

    // Commercial (écart 7).
    if (data.leadTimeDays !== undefined) columns.leadTimeDays = data.leadTimeDays
    if (data.rushService !== undefined) columns.rushService = data.rushService
    if (data.rushLeadTimeDays !== undefined) columns.rushLeadTimeDays = data.rushLeadTimeDays

    // Médias (écart 8).
    if (data.videoUrl !== undefined) columns.videoUrl = data.videoUrl

    // Conformité (écart 4) — `is_eco` est dérivé (`refreshIsEco`), jamais ici.
    if (data.recycledContentPercent !== undefined)
      columns.recycledContentPercent = data.recycledContentPercent
    if (data.cautionComment !== undefined) columns.cautionComment = data.cautionComment
    return columns
  }

  /**
   * La langue source doit avoir un texte à l'issue de la mise à jour : déjà en
   * base, ou fourni (avec un nom) dans le payload.
   */
  private async assertSourceExists(
    product: Product,
    sourceLocale: ContentLocale,
    provided: { name?: string } | undefined
  ): Promise<void> {
    if (provided?.name) return
    const existing = await ProductTranslation.query()
      .where('productId', product.id)
      .where('locale', sourceLocale)
      .first()
    if (!existing) throw missingSourceTranslation(sourceLocale)
  }

  /**
   * Écrit les traductions **saisies** (`is_auto = false`). Une ligne inchangée
   * garde son marquage : renvoyer tout le formulaire ne transforme pas les
   * traductions auto en manuelles. Une langue absente du payload n'est pas
   * touchée.
   */
  private async writeTranslations(
    product: Product,
    translations: SupplierProductUpdateInput['translations']
  ): Promise<void> {
    if (!translations) return
    for (const locale of CONTENT_LOCALES) {
      const translation = translations[locale]
      if (!translation) continue

      const existing = await ProductTranslation.query()
        .where('productId', product.id)
        .where('locale', locale)
        .first()

      if (!existing) {
        if (!translation.name) continue
        await ProductTranslation.create({
          productId: product.id,
          locale,
          name: translation.name,
          description: translation.description ?? null,
          keywords: translation.keywords ?? null,
          marketingPoints: translation.marketingPoints ?? null,
          isAuto: false,
        })
        continue
      }

      const name = translation.name ?? existing.name
      const description =
        translation.description === undefined ? existing.description : translation.description
      // Listes par locale (écart 5) : absentes = conservées.
      const keywords = translation.keywords === undefined ? existing.keywords : translation.keywords
      const marketingPoints =
        translation.marketingPoints === undefined
          ? existing.marketingPoints
          : translation.marketingPoints
      const unchanged =
        name === existing.name &&
        description === existing.description &&
        JSON.stringify(keywords) === JSON.stringify(existing.keywords) &&
        JSON.stringify(marketingPoints) === JSON.stringify(existing.marketingPoints)
      if (unchanged) continue
      await existing.merge({ name, description, keywords, marketingPoints, isAuto: false }).save()
    }
  }

  /**
   * Remplace les facettes du produit (mécanisme du « ET fiable » : le pivot
   * `product_attributes` porte `attribute_id`).
   */
  private async syncFacets(product: Product, valueIds: number[] = []): Promise<void> {
    if (valueIds.length === 0) {
      await product.related('attributeValues').sync({})
      return
    }
    const values = await AttributeValue.query().whereIn('id', valueIds).select('id', 'attributeId')
    const pivot: Record<number, { attribute_id: number }> = {}
    for (const value of values) {
      pivot[value.id] = { attribute_id: value.attributeId }
    }
    await product.related('attributeValues').sync(pivot)
  }

  /**
   * Remplace les labels de conformité du produit (écart 4). Pivot
   * `product_certifications` sans colonne additionnelle : une simple liste d'ids.
   */
  private async syncCertifications(
    product: Product,
    certificationIds: number[] = []
  ): Promise<void> {
    if (certificationIds.length === 0) {
      await product.related('certifications').sync([])
      return
    }
    // Ne synchronise que des labels **existants** : un id inconnu (requête
    // obsolète ou forgée) est ignoré plutôt que de lever une violation de clé
    // étrangère (500) — même garde que `syncFacets` pour les facettes.
    const existing = await Certification.query().whereIn('id', certificationIds).select('id')
    await product.related('certifications').sync(existing.map((certification) => certification.id))
  }

  /**
   * Upsert 1:1 du conditionnement / logistique (écart 3). `packaging` absent =
   * inchangé ; fourni = crée ou met à jour l'unique ligne `product_packagings`
   * (les champs absents de l'objet fourni sont remis à `null` : remplacement
   * complet du bloc). Un bloc **entièrement vide** ne crée pas de ligne et
   * supprime celle existante (pas de ligne fantôme en base). `outerCartonVolumeM3`
   * est un décimal (string en base).
   */
  private async syncPackaging(
    trx: TransactionClientContract,
    product: Product,
    packaging: ProductPackagingInput | undefined
  ): Promise<void> {
    if (packaging === undefined) return
    const decimal = (value: number | null | undefined) =>
      typeof value === 'number' ? String(value) : null
    const columns = {
      packageType: packaging.packageType ?? null,
      unitGrossWeightG: packaging.unitGrossWeightG ?? null,
      innerCartonQty: packaging.innerCartonQty ?? null,
      outerCartonQty: packaging.outerCartonQty ?? null,
      outerCartonLengthMm: packaging.outerCartonLengthMm ?? null,
      outerCartonWidthMm: packaging.outerCartonWidthMm ?? null,
      outerCartonHeightMm: packaging.outerCartonHeightMm ?? null,
      outerCartonGrossWeightG: packaging.outerCartonGrossWeightG ?? null,
      outerCartonVolumeM3: decimal(packaging.outerCartonVolumeM3),
    }

    // Bloc vide (rien de renseigné) : ne crée pas de ligne, et retire celle qui
    // existait (effacement complet depuis le formulaire). Évite une ligne vide
    // par produit + un preload inutile.
    if (Object.values(columns).every((value) => value === null)) {
      await ProductPackaging.query({ client: trx }).where('productId', product.id).delete()
      return
    }

    await ProductPackaging.updateOrCreate({ productId: product.id }, columns, { client: trx })
  }

  /**
   * Recale le filtre dérivé « Éco-responsable » (écart 4) sur l'état courant du
   * produit : part de recyclé, matières portées et labels éco. Jamais saisi —
   * toujours calculé ici (et rattrapé à l'indexation). Idempotent : n'écrit que
   * si la valeur change.
   */
  private async refreshIsEco(product: Product): Promise<void> {
    // Seules les valeurs de l'attribut `material` comptent comme matière éco
    // (un slug homonyme sous un autre attribut ne doit pas marquer éco).
    const materials = await product
      .related('attributeValues')
      .query()
      .whereHas('attribute', (attribute) => attribute.where('slug', MATERIAL_ATTRIBUTE_SLUG))
      .select('slug')
    const ecoCertification = await product
      .related('certifications')
      .query()
      .where('is_eco', true)
      .first()

    const isEco = this.eco.deriveIsEco({
      recycledContentPercent: product.recycledContentPercent,
      materialSlugs: materials.map((value) => value.slug),
      hasEcoCertification: ecoCertification !== null,
    })
    if (isEco !== product.isEco) {
      product.isEco = isEco
      await product.save()
    }
  }

  /**
   * Stocke les fichiers (dédoublonnés) et crée les lignes `product_images` à
   * partir de la position `from`. Si l'écriture des lignes échoue, les objets
   * tout juste stockés sont libérés.
   */
  private async attachImages(
    product: Product,
    files: MultipartFile[],
    from: number
  ): Promise<void> {
    if (files.length === 0) return
    const objects = await this.storage.storeMany(files)

    let created: ProductImage[]
    try {
      created = await product.related('images').createMany(
        objects.map((object, index) => ({
          secureUrl: this.storage.urlFor(object),
          storageObjectId: object.id,
          position: from + index,
        }))
      )
    } catch (error) {
      await this.storage.discard(objects.map((object) => object.id))
      throw error
    }
    await this.queueVariants(created)
  }

  /**
   * Recale `products.image_url` (image principale dénormalisée) sur la première
   * image de la galerie, ou `null` s'il n'en reste aucune.
   */
  private async refreshPrimaryImage(product: Product): Promise<void> {
    const first = await product.related('images').query().orderBy('position').first()
    await product.merge({ imageUrl: first?.secureUrl ?? null }).save()
  }

  /**
   * Slug dérivé du nom, rendu unique par suffixe numérique (cf. onboarding).
   */
  private async uniqueSlug(
    name: string,
    exists: (slug: string) => Promise<boolean>
  ): Promise<string> {
    const base = stringHelpers.slug(name, { lower: true }) || 'produit'
    let slug = base
    let suffix = 2
    while (await exists(slug)) {
      slug = `${base}-${suffix}`
      suffix += 1
    }
    return slug
  }
}
