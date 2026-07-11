import stringHelpers from '@adonisjs/core/helpers/string'
import Product from '#models/product'
import Supplier from '#models/supplier'
import Category from '#models/category'
import Attribute from '#models/attribute'
import AttributeValue from '#models/attribute_value'
import ProductImage from '#models/product_image'
import ProductTranslation from '#models/product_translation'
import SupplierTranslation from '#models/supplier_translation'
import CloudinaryService from '#services/cloudinary_service'
import GenerateProductEmbeddingJob from '#jobs/generate_product_embedding_job'
import logger from '@adonisjs/core/services/logger'
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '#shared/types/i18n'
import type Organization from '#models/organization'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import type { SupplierProductInput } from '#shared/types/product'

/**
 * Gestion des produits côté fournisseur (CRUD + galerie Cloudinary). Toute la
 * logique ORM vit ici (controllers fins). `CloudinaryService` est injecté pour
 * la testabilité (les tests passent un faux uploader, aucun appel réseau).
 */
export default class SupplierProductService {
  constructor(private cloudinary: CloudinaryService = new CloudinaryService()) {}

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
    for (const locale of SUPPORTED_LOCALES) {
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
      .preload('images', (images) => images.orderBy('position'))
      .orderBy('slug')
  }

  /**
   * Produit possédé par l'org (ownership garanti via le fournisseur), avec tout
   * le nécessaire à l'édition. `null` si introuvable ou hors de l'org.
   */
  findOwned(org: Organization, productId: number): Promise<Product | null> {
    return Product.query()
      .where('id', productId)
      .whereHas('supplier', (supplier) => supplier.where('organizationId', org.id))
      .preload('translations')
      .preload('images', (images) => images.orderBy('position'))
      .preload('attributeValues')
      .first()
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
    const supplier = await this.resolveSupplier(org)
    const slug = await this.uniqueSlug(
      data.translations[DEFAULT_LOCALE].name,
      async (s) => !!(await Product.findBy('slug', s))
    )

    const product = await Product.create({ supplierId: supplier.id, slug, ...this.toColumns(data) })

    await this.writeTranslations(product, data.translations)
    await this.syncFacets(product, data.attributeValueIds)
    await this.attachImages(product, files, 0)
    await this.refreshPrimaryImage(product)
    await this.queueEmbedding(product)

    return product
  }

  /**
   * Met à jour un produit : champs, traductions, facettes (remplacées), et
   * galerie (suppression des images retirées + ajout des nouvelles).
   */
  async update(
    product: Product,
    data: SupplierProductInput,
    files: MultipartFile[],
    removedImageIds: number[] = []
  ): Promise<Product> {
    await product.merge(this.toColumns(data)).save()
    await this.writeTranslations(product, data.translations)
    await this.syncFacets(product, data.attributeValueIds)

    if (removedImageIds.length > 0) {
      const removed = await ProductImage.query()
        .whereIn('id', removedImageIds)
        .where('productId', product.id)
      await this.cloudinary.destroyMany(removed.map((image) => image.publicId))
      await ProductImage.query()
        .whereIn(
          'id',
          removed.map((image) => image.id)
        )
        .delete()
    }

    const last = await product.related('images').query().orderBy('position', 'desc').first()
    await this.attachImages(product, files, last ? last.position + 1 : 0)
    await this.refreshPrimaryImage(product)
    await this.queueEmbedding(product)

    return product
  }

  /**
   * Supprime un produit et ses assets Cloudinary. Les lignes filles
   * (translations, images, facettes) partent en cascade DB.
   */
  async delete(product: Product): Promise<void> {
    const images = await product.related('images').query()
    await this.cloudinary.destroyMany(images.map((image) => image.publicId))
    await product.delete()
  }

  /**
   * Planifie le (re)calcul de l'embedding sémantique du produit. Résilient : un
   * échec de queue ne doit jamais faire échouer la création/mise à jour produit
   * (no-op côté job tant que l'IA est désactivée).
   */
  private async queueEmbedding(product: Product): Promise<void> {
    try {
      await GenerateProductEmbeddingJob.dispatch({ productId: product.id })
    } catch (error) {
      logger.warn({ err: error, productId: product.id }, 'failed to queue product embedding')
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
   */
  private toColumns(data: SupplierProductInput) {
    return {
      categoryId: data.categoryId,
      priceMin: typeof data.priceMin === 'number' ? String(data.priceMin) : null,
      priceMax: typeof data.priceMax === 'number' ? String(data.priceMax) : null,
      currency: data.currency ?? 'EUR',
      minQuantity: data.minQuantity ?? null,
      originCountry: data.originCountry ?? null,
      madeInEurope: data.madeInEurope ?? false,
      isActive: data.isActive ?? true,
    }
  }

  private async writeTranslations(
    product: Product,
    translations: SupplierProductInput['translations']
  ): Promise<void> {
    for (const locale of SUPPORTED_LOCALES) {
      const translation = translations[locale]
      if (!translation) continue
      await ProductTranslation.updateOrCreate(
        { productId: product.id, locale },
        { name: translation.name, description: translation.description ?? null }
      )
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
   * Upload des fichiers sur Cloudinary et création des lignes `product_images`
   * à partir de la position `from`.
   */
  private async attachImages(
    product: Product,
    files: MultipartFile[],
    from: number
  ): Promise<void> {
    if (files.length === 0) return
    const assets = await this.cloudinary.uploadMany(files, `products/${product.slug}`)
    await product.related('images').createMany(
      assets.map((asset, index) => ({
        secureUrl: asset.secureUrl,
        publicId: asset.publicId,
        width: asset.width,
        height: asset.height,
        position: from + index,
      }))
    )
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
