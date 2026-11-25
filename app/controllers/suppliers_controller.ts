import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import ActivityEventService from '#services/activity_event_service'
import SupplierDirectoryService from '#services/supplier_directory_service'
import DocumentService from '#services/document_service'
import SearchEventService from '#services/search_event_service'
import SupplierContactService from '#services/supplier_contact_service'
import SupplierContactTransformer from '#transformers/supplier_contact_transformer'
import SupplierTransformer from '#transformers/supplier_transformer'
import SupplierDetailTransformer from '#transformers/supplier_detail_transformer'
import type { Locale } from '#shared/types/i18n'

const PER_PAGE = 12

@inject()
export default class SuppliersController {
  constructor(
    private service: SupplierDirectoryService,
    private documents: DocumentService,
    private searchEvents: SearchEventService,
    private activityEvents: ActivityEventService,
    private contacts: SupplierContactService
  ) {}

  /**
   * Annuaire public paginé + filtrable (recherche par nom, filtre pays).
   */
  async index({ inertia, request, i18n, auth }: HttpContext) {
    const locale = i18n.locale as Locale
    const qs = request.qs()

    const filters = {
      search: typeof qs.search === 'string' && qs.search.trim() ? qs.search.trim() : null,
      country: typeof qs.country === 'string' && qs.country.trim() ? qs.country.trim() : null,
    }
    const page = Number.parseInt(qs.page, 10) || 1

    const paginator = await this.service.list({ ...filters, page, perPage: PER_PAGE })
    const countries = await this.service.availableCountries()

    // Journal des recherches (#171) : mis en file, n'échoue jamais.
    await this.searchEvents.trackSuppliers({
      filters,
      page,
      total: paginator.total,
      user: auth.user ?? null,
      locale,
    })

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
   * Fiche fournisseur publique : profil + catalogue produits + contacts
   * commerciaux visibles par le visiteur.
   */
  async show({ inertia, params, i18n, auth }: HttpContext) {
    const locale = i18n.locale as Locale
    const supplier = await this.service.findBySlug(params.slug)

    if (!supplier) {
      throw new Exception('Supplier not found', { status: 404, code: 'E_SUPPLIER_NOT_FOUND' })
    }

    await this.activityEvents.record({
      type: 'supplier_viewed',
      targetType: 'supplier',
      targetId: supplier.id,
      userId: auth.user?.id ?? null,
      organizationId: auth.user?.currentOrganizationId ?? null,
      isStaff: auth.user?.hasBackOffice ?? false,
    })

    // Équipe commerciale (#241) : filtrée côté serveur selon le visiteur.
    const contacts = supplier.organizationId
      ? await this.contacts.visibleFor(
          supplier.organizationId,
          await this.contacts.viewerFor(auth.user)
        )
      : []

    return inertia.render('suppliers/show', {
      supplier: new SupplierDetailTransformer(supplier, locale, this.documents.urlFor).toObject(),
      contacts: contacts.map((contact) => new SupplierContactTransformer(contact).toObject()),
    })
  }
}
