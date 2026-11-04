import db from '@adonisjs/lucid/services/db'
import Product from '#models/product'
import Category from '#models/category'
import ModerationDecisionRecord from '#models/moderation_decision'
import ProductImageTransformer from '#transformers/product_image_transformer'
import { AdminProductNotFoundException } from '#exceptions/admin_product_errors'
import { currentStatusSql, latestDecisionIsRejectedSql } from '#shared/helpers/moderation'
import { resolveTranslation } from '#shared/helpers/translations'
import { CONTENT_LOCALES } from '#shared/types/i18n'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type {
  AdminProductIndexFilters,
  AdminProductCategoryOption,
  AdminProductSupplierOption,
  AdminProductVisibilityStatus,
  AdminProductModerationHistory,
  AdminProductTranslation,
  AdminProductCertification,
  AdminProductAttribute,
  AdminProductVariant,
  AdminProductPriceTier,
} from '#shared/types/admin_product'
import type { TranslationLocale } from '#shared/types/i18n'
import type { ProductImageType } from '#shared/types/product'

interface ListOptions extends AdminProductIndexFilters {
  page: number
  perPage: number
  locale: TranslationLocale
}

export interface AdminProductDetails {
  product: Product
  visibilityStatus: AdminProductVisibilityStatus
  moderationStatus: string
  moderationHistory: AdminProductModerationHistory[]
  variants: AdminProductVariant[]
  priceTiers: AdminProductPriceTier[]
  images: ProductImageType[]
  translations: AdminProductTranslation[]
  certifications: AdminProductCertification[]
  attributes: AdminProductAttribute[]
  supplierName: string | null
  supplierSlug: string | null
  supplierOrganizationId: number | null
  categoryName: string | null
  categorySlug: string | null
  variantsCount: number
  imagesCount: number
}

/** Langue de repli du nom d'un produit quand la langue de l'ecran manque. */
const FALLBACK_LOCALE = 'fr'

/**
 * Consultation des produits par l'equipe plateforme : tous les produits,
 * y compris inactifs, archives ou masques.
 */
export default class AdminProductService {
  /**
   * Liste paginee, filtrable par fournisseur, categorie, visibilite, qualite,
   * avec recherche sur nom traduit, slug, SKU de variante ou nom d'organisation.
   * Les plus recents d'abord.
   */
  async list(
    options: ListOptions
  ): Promise<{ paginator: ModelPaginatorContract<Product>; names: Map<number, string> }> {
    const { page, perPage, search, supplierId, categoryId, visibility, quality, locale } = options

    let query = Product.query()
      .preload('supplier', (supplier) => supplier.preload('organization'))
      .preload('category', (category) => category.preload('translations'))
      .withCount('variants', (q) => q.as('variants_count'))
      .withCount('images', (q) => q.as('images_count'))

    // Recherche sur nom traduit, slug, SKU de variante ou nom d'organisation
    if (search) {
      const pattern = `%${escapeLike(search)}%`
      query = query.where((sub) =>
        sub
          .whereILike('slug', pattern)
          .orWhereHas('translations', (t) => t.whereILike('name', pattern))
          .orWhereHas('variants', (v) => v.whereILike('sku', pattern))
          .orWhereHas('supplier', (s) =>
            s.whereHas('organization', (o) => o.whereILike('name', pattern))
          )
      )
    }

    // Filtre par fournisseur (organisation)
    if (supplierId) {
      query = query.whereHas('supplier', (s) => s.where('organizationId', supplierId))
    }

    // Filtre par categorie (inclut les sous-categories)
    if (categoryId) {
      const categoryIds = await this.getCategoryWithDescendants(categoryId)
      query = query.whereIn('categoryId', categoryIds)
    }

    // Filtre de visibilite
    if (visibility) {
      switch (visibility) {
        case 'published':
          // is_active=true ET lifecycle_status!='retired' ET derniere decision != rejected
          query = query
            .where('isActive', true)
            .where('lifecycleStatus', '!=', 'retired')
            .whereRaw(`NOT ${latestDecisionIsRejectedSql('product', 'products.id')}`)
          break
        case 'unpublished':
          // is_active=false
          query = query.where('isActive', false)
          break
        case 'hidden':
          // derniere decision = rejected
          query = query.whereRaw(latestDecisionIsRejectedSql('product', 'products.id'))
          break
        case 'archived':
          // lifecycle_status='retired'
          query = query.where('lifecycleStatus', 'retired')
          break
      }
    }

    // Filtre de qualite
    if (quality) {
      switch (quality) {
        case 'no_image':
          query = query.whereDoesntHave('images', () => {})
          break
        case 'no_translation':
          // Moins de traductions que de locales de contenu
          query = query.whereRaw(
            '(SELECT COUNT(*) FROM product_translations WHERE product_id = products.id) < ?',
            [CONTENT_LOCALES.length]
          )
          break
        case 'no_variant':
          query = query.whereDoesntHave('variants', () => {})
          break
      }
    }

    const paginator = await query
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .paginate(page, perPage)

    // Charge les noms traduits
    const productIds = paginator.all().map((p) => p.id)
    const names = await this.productNames(productIds, locale)

    return { paginator, names }
  }

  /**
   * Recherche le produit par id, sans lever d'exception.
   */
  find(id: number): Promise<Product | null> {
    return Product.find(id)
  }

  /**
   * Fiche d'un produit : toutes les informations detaillees.
   */
  async details(id: number, locale: TranslationLocale): Promise<AdminProductDetails> {
    const product = await Product.query()
      .where('id', id)
      .preload('supplier', (supplier) => supplier.preload('organization').preload('translations'))
      .preload('category', (category) => category.preload('translations'))
      .preload('translations')
      .preload('variants')
      .preload('priceTiers')
      .preload('images', (images) => images.preload('variants').orderBy('position', 'asc'))
      .preload('certifications', (certs) => certs.preload('translations'))
      .preload('productAttributes', (attrs) =>
        attrs
          .preload('attribute', (attr) => attr.preload('translations'))
          .preload('attributeValue', (val) => val.preload('translations'))
      )
      .withCount('variants', (q) => q.as('variants_count'))
      .withCount('images', (q) => q.as('images_count'))
      .first()

    if (!product) throw new AdminProductNotFoundException()

    // Statut de visibilite calcule
    const visibilityStatus = await this.computeVisibilityStatus(product)

    // Statut de moderation courant
    const moderationStatus = await this.getModerationStatus(product.id)

    // Historique de moderation
    const moderationRecords = await ModerationDecisionRecord.query()
      .where('targetType', 'product')
      .where('targetId', product.id)
      .preload('decidedBy')
      .orderBy('decidedAt', 'desc')
      .orderBy('id', 'desc')

    const moderationHistory: AdminProductModerationHistory[] = moderationRecords.map((record) => ({
      id: record.id,
      status: record.status,
      reason: record.reason,
      decidedByEmail: record.decidedBy?.email ?? null,
      decidedAt: record.decidedAt.toISO()!,
    }))

    // Variantes
    const variants: AdminProductVariant[] = product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      stockStatus: v.stockStatus,
      isActive: v.isActive,
    }))

    // Paliers de prix
    const priceTiers: AdminProductPriceTier[] = product.priceTiers.map((tier) => ({
      id: tier.id,
      variantId: tier.variantId,
      minQuantity: tier.minQuantity,
      unitPrice: tier.unitPrice,
      currency: tier.currency,
    }))

    // Images
    const images: ProductImageType[] = product.images.map((img) =>
      new ProductImageTransformer(img).toObject()
    )

    // Traductions
    const translations: AdminProductTranslation[] = CONTENT_LOCALES.map((loc) => {
      const translation = product.translations.find((t) => t.locale === loc)
      return {
        locale: loc,
        name: translation?.name ?? null,
        hasDescription: Boolean(translation?.description),
      }
    })

    // Certifications
    const certifications: AdminProductCertification[] = product.certifications.map((cert) => {
      const resolved = resolveTranslation(cert.translations, locale, {
        sourceLocale: cert.sourceLocale,
        fallback: FALLBACK_LOCALE,
      })
      return {
        id: cert.id,
        slug: cert.slug,
        name: resolved?.name ?? null,
      }
    })

    // Attributs
    const attributes: AdminProductAttribute[] = product.productAttributes.flatMap((row) => {
      const attrResolved = resolveTranslation(row.attribute?.translations, locale, {
        sourceLocale: row.attribute?.sourceLocale,
        fallback: FALLBACK_LOCALE,
      })
      const valResolved = row.attributeValue
        ? resolveTranslation(row.attributeValue.translations, locale, {
            sourceLocale: row.attributeValue.sourceLocale,
            fallback: FALLBACK_LOCALE,
          })
        : null
      const label =
        valResolved?.label ?? row.valueString ?? (row.valueNumber ? `${row.valueNumber}` : null)
      if (!attrResolved?.name || !label) return []
      return [
        {
          attributeSlug: row.attribute.slug,
          attributeName: attrResolved.name,
          label,
        },
      ]
    })

    // Infos fournisseur
    const supplierResolved = resolveTranslation(product.supplier?.translations, locale, {
      fallback: FALLBACK_LOCALE,
    })
    const supplierName = supplierResolved?.name ?? product.supplier?.organization?.name ?? null
    const supplierSlug = product.supplier?.slug ?? null
    const supplierOrganizationId = product.supplier?.organizationId ?? null

    // Infos categorie
    const categoryResolved = product.category
      ? resolveTranslation(product.category.translations, locale, {
          sourceLocale: product.category.sourceLocale,
          fallback: FALLBACK_LOCALE,
        })
      : null
    const categoryName = categoryResolved?.name ?? null
    const categorySlug = product.category?.slug ?? null

    return {
      product,
      visibilityStatus,
      moderationStatus,
      moderationHistory,
      variants,
      priceTiers,
      images,
      translations,
      certifications,
      attributes,
      supplierName,
      supplierSlug,
      supplierOrganizationId,
      categoryName,
      categorySlug,
      variantsCount: Number(product.$extras.variants_count ?? 0),
      imagesCount: Number(product.$extras.images_count ?? 0),
    }
  }

  /**
   * Liste des categories pour le filtre (arbre aplati avec profondeur).
   */
  async categoryOptions(locale: TranslationLocale): Promise<AdminProductCategoryOption[]> {
    const categories = await Category.query()
      .preload('translations')
      .orderBy('parentId', 'asc')
      .orderBy('position', 'asc')

    const result: AdminProductCategoryOption[] = []
    const roots = categories.filter((c) => c.parentId === null)

    const walk = (cats: Category[], depth: number) => {
      for (const cat of cats) {
        const resolved = resolveTranslation(cat.translations, locale, {
          sourceLocale: cat.sourceLocale,
          fallback: FALLBACK_LOCALE,
        })
        result.push({
          id: cat.id,
          name: resolved?.name ?? cat.slug,
          depth,
        })
        const children = categories.filter((c) => c.parentId === cat.id)
        if (children.length > 0) walk(children, depth + 1)
      }
    }

    walk(roots, 0)
    return result
  }

  /**
   * Liste des fournisseurs (organisations) pour le filtre.
   */
  async supplierOptions(): Promise<AdminProductSupplierOption[]> {
    const suppliers = await db
      .from('suppliers')
      .join('organizations', 'organizations.id', 'suppliers.organization_id')
      .whereNotNull('suppliers.organization_id')
      .select('organizations.id', 'organizations.name')
      .orderBy('organizations.name', 'asc')
      .distinct('organizations.id')

    return suppliers.map((row: { id: number; name: string }) => ({
      id: row.id,
      name: row.name,
    }))
  }

  /**
   * Recupere les ids de la categorie et de tous ses descendants.
   */
  private async getCategoryWithDescendants(categoryId: number): Promise<number[]> {
    const categories = await Category.query().select('id', 'parentId')
    const ids: number[] = [categoryId]
    let current = [categoryId]

    while (current.length > 0) {
      const children = categories.filter((c) => c.parentId && current.includes(c.parentId))
      const childIds = children.map((c) => c.id)
      ids.push(...childIds)
      current = childIds
    }

    return ids
  }

  /**
   * Calcule le statut de visibilite d'un produit.
   */
  private async computeVisibilityStatus(product: Product): Promise<AdminProductVisibilityStatus> {
    // D'abord on verifie l'archivage
    if (product.lifecycleStatus === 'retired') return 'archived'

    // Ensuite le masquage (moderation)
    const isRejected = await this.isLatestDecisionRejected(product.id)
    if (isRejected) return 'hidden'

    // Enfin la publication
    return product.isActive ? 'published' : 'unpublished'
  }

  private async isLatestDecisionRejected(productId: number): Promise<boolean> {
    const result = await db.rawQuery(
      `SELECT ${latestDecisionIsRejectedSql('product', '?')} AS is_rejected`,
      [productId]
    )
    return result.rows[0]?.is_rejected === true
  }

  private async getModerationStatus(productId: number): Promise<string> {
    const result = await db.rawQuery(`SELECT ${currentStatusSql('product', '?')} AS status`, [
      productId,
    ])
    return result.rows[0]?.status ?? 'pending'
  }

  /**
   * Charge les noms traduits des produits (avec repli).
   */
  private async productNames(
    ids: number[],
    locale: TranslationLocale
  ): Promise<Map<number, string>> {
    const names = new Map<number, string>()
    if (ids.length === 0) return names

    const [translations, products] = await Promise.all([
      db
        .from('product_translations')
        .whereIn('product_id', ids)
        .select('product_id', 'locale', 'name'),
      db.from('products').whereIn('id', ids).select('id', 'source_locale'),
    ])
    const sources = new Map<number, string>(products.map((p) => [p.id, p.source_locale]))

    for (const id of ids) {
      const own = translations.filter((row) => row.product_id === id)
      const picked = resolveTranslation(own, locale, {
        sourceLocale: sources.get(id) as TranslationLocale | undefined,
        fallback: FALLBACK_LOCALE,
      })
      if (picked?.name) names.set(id, picked.name)
    }
    return names
  }
}

/**
 * Neutralise les jokers `%` et `_` (et l'echappement) d'une saisie utilisateur
 * avant de l'inserer dans un motif `ILIKE`.
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}
