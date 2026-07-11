import type { HttpContext } from '@adonisjs/core/http'
import ProductCatalogueService from '#services/product_catalogue_service'
import ProductTransformer from '#transformers/product_transformer'
import ProductDetailTransformer from '#transformers/product_detail_transformer'
import CategoryTransformer from '#transformers/category_transformer'
import AttributeTransformer from '#transformers/attribute_transformer'
import AttributeValueTransformer from '#transformers/attribute_value_transformer'
import { ProductNotFoundException } from '#exceptions/catalogue_errors'
import type { Locale } from '#shared/types/i18n'
import type { ProductDirectoryFilters } from '#shared/types/product'

const PER_PAGE = 12

export default class ProductsController {
  private service = new ProductCatalogueService()

  /**
   * Catalogue public paginé + filtrable : recherche full-text locale-aware,
   * filtre catégorie / made-in-Europe, facettes attributs en ET fiable.
   */
  async index({ inertia, request, i18n }: HttpContext) {
    const locale = i18n.locale as Locale
    const qs = request.qs()

    const filters: ProductDirectoryFilters = {
      search: typeof qs.search === 'string' && qs.search.trim() ? qs.search.trim() : null,
      categoryId: Number.parseInt(qs.categoryId, 10) || null,
      madeInEurope: qs.madeInEurope === 'true',
      attributeValueIds: this.parseIds(qs.attributeValueIds),
    }
    const page = Number.parseInt(qs.page, 10) || 1

    const paginator = await this.service.list({ ...filters, page, perPage: PER_PAGE, locale })
    const categories = await this.service.availableCategories()
    const attributes = await this.service.filterableAttributes()

    return inertia.render('products/index', {
      products: {
        data: paginator.all().map((product) => new ProductTransformer(product, locale).toObject()),
        meta: {
          total: paginator.total,
          perPage: paginator.perPage,
          currentPage: paginator.currentPage,
          lastPage: paginator.lastPage,
        },
      },
      filters,
      categories: categories.map((category) =>
        new CategoryTransformer(category, locale).toObject()
      ),
      attributes: attributes.map((attribute) => ({
        ...new AttributeTransformer(attribute, locale).toObject(),
        values: attribute.values.map((value) =>
          new AttributeValueTransformer(value, locale).toObject()
        ),
      })),
    })
  }

  /**
   * Fiche produit publique : produit localisé + fournisseur, catégorie, facettes.
   */
  async show({ inertia, params, i18n }: HttpContext) {
    const locale = i18n.locale as Locale
    const product = await this.service.findBySlug(params.slug)

    if (!product) {
      throw new ProductNotFoundException()
    }

    return inertia.render('products/show', {
      product: new ProductDetailTransformer(product, locale).toObject(),
    })
  }

  /**
   * Normalise le paramètre `attributeValueIds` (répété ou unique) en `number[]`.
   */
  private parseIds(raw: unknown): number[] {
    const list = Array.isArray(raw) ? raw : raw !== undefined ? [raw] : []
    return list
      .map((value) => Number.parseInt(String(value), 10))
      .filter((value) => Number.isInteger(value) && value > 0)
  }
}
