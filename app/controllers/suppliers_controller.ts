import type { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'
import SupplierDirectoryService from '#services/supplier_directory_service'
import SupplierTransformer from '#transformers/supplier_transformer'
import SupplierDetailTransformer from '#transformers/supplier_detail_transformer'
import type { Locale } from '#shared/types/i18n'

const PER_PAGE = 12

export default class SuppliersController {
  private service = new SupplierDirectoryService()

  /**
   * Annuaire public paginé + filtrable (recherche par nom, filtre pays).
   */
  async index({ inertia, request, i18n }: HttpContext) {
    const locale = i18n.locale as Locale
    const qs = request.qs()

    const filters = {
      search: typeof qs.search === 'string' && qs.search.trim() ? qs.search.trim() : null,
      country: typeof qs.country === 'string' && qs.country.trim() ? qs.country.trim() : null,
    }
    const page = Number.parseInt(qs.page, 10) || 1

    const paginator = await this.service.list({ ...filters, page, perPage: PER_PAGE })
    const countries = await this.service.availableCountries()

    return inertia.render('suppliers/index', {
      suppliers: {
        data: paginator
          .all()
          .map((supplier) => new SupplierTransformer(supplier, locale).toObject()),
        meta: {
          total: paginator.total,
          perPage: paginator.perPage,
          currentPage: paginator.currentPage,
          lastPage: paginator.lastPage,
        },
      },
      filters,
      countries,
    })
  }

  /**
   * Fiche fournisseur publique : profil + catalogue produits.
   */
  async show({ inertia, params, i18n }: HttpContext) {
    const locale = i18n.locale as Locale
    const supplier = await this.service.findBySlug(params.slug)

    if (!supplier) {
      throw new Exception('Supplier not found', { status: 404, code: 'E_SUPPLIER_NOT_FOUND' })
    }

    return inertia.render('suppliers/show', {
      supplier: new SupplierDetailTransformer(supplier, locale).toObject(),
    })
  }
}
