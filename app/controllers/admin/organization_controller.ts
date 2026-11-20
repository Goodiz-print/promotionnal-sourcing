import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import AdminOrganizationService from '#services/admin_organization_service'
import AdminOrganizationTransformer from '#transformers/admin_organization_transformer'
import AdminOrganizationDetailTransformer from '#transformers/admin_organization_detail_transformer'
import RoleTransformer from '#transformers/role_transformer'
import { adminOrganizationFiltersValidator } from '#validators/admin_organization'
import { ORGANIZATION_TYPES } from '#shared/types/organization'
import type {
  AdminOrganizationIndexFilters,
  AdminOrganizationFilterOptions,
} from '#shared/types/admin_organization'

const PER_PAGE = 25

/**
 * Consultation des organisations par l'equipe plateforme (liste filtrable par
 * type, statut d'archivage, pays et recherche ; fiche detaillee). Droit
 * `organizations.view`. Les actions de gestion sont dans
 * `OrganizationManagementController`.
 */
@inject()
export default class OrganizationController {
  constructor(private service: AdminOrganizationService) {}

  async index({ bouncer, inertia, request }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'organizations.view')

    const query = await request.validateUsing(adminOrganizationFiltersValidator, {
      data: request.qs(),
    })

    const filters: AdminOrganizationIndexFilters = {
      search: query.search || null,
      type: query.type ?? null,
      status: query.status ?? 'active',
      country: query.country ?? null,
      missingQuoteAddress: query.missingQuoteAddress ?? false,
    }

    const paginator = await this.service.list({
      ...filters,
      page: query.page ?? 1,
      perPage: PER_PAGE,
    })

    // Options de filtres pour le frontend
    const countries = await this.service.distinctCountries()
    const filterOptions: AdminOrganizationFilterOptions = {
      organizationTypes: [...ORGANIZATION_TYPES],
      countries,
    }

    const canManage = await bouncer.allows('hasPlatformPermission', 'organizations.manage')

    return inertia.render('admin/organizations/index', {
      organizationList: {
        data: paginator
          .all()
          .map((organization) => new AdminOrganizationTransformer(organization).toObject()),
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

  async show({ bouncer, inertia, params }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'organizations.view')

    const [details, roles, canManage] = await Promise.all([
      this.service.details(Number(params.id)),
      this.service.roles(),
      bouncer.allows('hasPlatformPermission', 'organizations.manage'),
    ])

    return inertia.render('admin/organizations/show', {
      organization: new AdminOrganizationDetailTransformer(details, { canManage }).toObject(),
      roles: roles.map((role) => new RoleTransformer(role).toObject()),
    })
  }
}
