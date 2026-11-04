import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import AdminProductService from '#services/admin_product_service'
import AdminProductTransformer from '#transformers/admin_product_transformer'
import AdminProductDetailTransformer from '#transformers/admin_product_detail_transformer'
import { adminProductFiltersValidator } from '#validators/admin_product'
import { latestDecisionIsRejectedSql } from '#shared/helpers/moderation'
import type {
  AdminProductIndexFilters,
  AdminProductFilterOptions,
  AdminProductVisibilityStatus,
} from '#shared/types/admin_product'
import type { TranslationLocale } from '#shared/types/i18n'

const PER_PAGE = 25

/**
 * Consultation des produits par l'equipe plateforme (liste filtrable par
 * fournisseur, categorie, visibilite, qualite et recherche ; fiche detaillee).
 * Droit `products.view`. Les actions de gestion sont dans
 * `ProductManagementController`.
 */
@inject()
export default class ProductController {
  constructor(private service: AdminProductService) {}

  async index({ bouncer, inertia, request, i18n }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'products.view')

    const query = await request.validateUsing(adminProductFiltersValidator, {
      data: request.qs(),
    })

    const locale = i18n.locale as TranslationLocale

    const filters: AdminProductIndexFilters = {
      search: query.search || null,
      supplierId: query.supplierId ?? null,
      categoryId: query.categoryId ?? null,
      visibility: query.visibility ?? null,
      quality: query.quality ?? null,
    }

    const { paginator, names } = await this.service.list({
      ...filters,
      page: query.page ?? 1,
      perPage: PER_PAGE,
      locale,
    })

    // Calcul des statuts de visibilite pour chaque produit
    const visibilityStatuses = await this.computeVisibilityStatuses(paginator.all())

    // Options de filtres pour le frontend
    const [categories, suppliers] = await Promise.all([
      this.service.categoryOptions(locale),
      this.service.supplierOptions(),
    ])
    const filterOptions: AdminProductFilterOptions = {
      categories,
      suppliers,
    }

    const canManage = await bouncer.allows('hasPlatformPermission', 'products.manage')

    return inertia.render('admin/products/index', {
      productList: {
        data: paginator.all().map((product) =>
          new AdminProductTransformer(product, {
            names,
            visibilityStatuses,
            locale,
          }).toObject()
        ),
        meta: {
          total: paginator.total,
          perPage: paginator.perPage,
          currentPage: paginator.currentPage,
          lastPage: paginator.lastPage,
        },
      },
      filters,
      filterOptions,
      canManage,
    })
  }

  async show({ bouncer, inertia, params, i18n }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'products.view')

    const locale = i18n.locale as TranslationLocale
    const [details, canManage] = await Promise.all([
      this.service.details(Number(params.id), locale),
      bouncer.allows('hasPlatformPermission', 'products.manage'),
    ])

    return inertia.render('admin/products/show', {
      product: new AdminProductDetailTransformer(details, { canManage, locale }).toObject(),
    })
  }

  /**
   * Calcule le statut de visibilite pour un ensemble de produits.
   */
  private async computeVisibilityStatuses(
    products: { id: number; isActive: boolean; lifecycleStatus: string }[]
  ): Promise<Map<number, AdminProductVisibilityStatus>> {
    const result = new Map<number, AdminProductVisibilityStatus>()
    if (products.length === 0) return result

    // Recupere les produits masques (derniere decision = rejected)
    const ids = products.map((p) => p.id)
    const hiddenQuery = await db.rawQuery<{ rows: { id: number }[] }>(
      `SELECT id FROM products WHERE id = ANY(?) AND ${latestDecisionIsRejectedSql('product', 'products.id')}`,
      [ids]
    )
    const hiddenIds = new Set(hiddenQuery.rows.map((r) => r.id))

    for (const product of products) {
      if (product.lifecycleStatus === 'retired') {
        result.set(product.id, 'archived')
      } else if (hiddenIds.has(product.id)) {
        result.set(product.id, 'hidden')
      } else if (product.isActive) {
        result.set(product.id, 'published')
      } else {
        result.set(product.id, 'unpublished')
      }
    }

    return result
  }
}
