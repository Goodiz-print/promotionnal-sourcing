import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import AdminOrganizationService from '#services/admin_organization_service'
import AdminOrganizationTransformer from '#transformers/admin_organization_transformer'
import AdminOrganizationDetailTransformer from '#transformers/admin_organization_detail_transformer'
import { ORGANIZATION_TYPES, type OrganizationKind } from '#shared/types/organization'
import {
  ADMIN_ORGANIZATION_STATUSES,
  type AdminOrganizationFilters,
  type AdminOrganizationStatus,
} from '#shared/types/admin'

const PER_PAGE = 25

/**
 * Consultation des organisations par l'équipe plateforme (liste filtrable par
 * type et statut d'archivage, fiche détaillée). Droit `organizations.view`.
 */
@inject()
export default class OrganizationController {
  constructor(private service: AdminOrganizationService) {}

  async index({ bouncer, inertia, request }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'organizations.view')

    const qs = request.qs()
    const filters: AdminOrganizationFilters = {
      type: ORGANIZATION_TYPES.includes(qs.type) ? (qs.type as OrganizationKind) : null,
      status: ADMIN_ORGANIZATION_STATUSES.includes(qs.status)
        ? (qs.status as AdminOrganizationStatus)
        : 'active',
    }
    const page = Number.parseInt(qs.page, 10) || 1

    const paginator = await this.service.list({ ...filters, page, perPage: PER_PAGE })

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
    })
  }

  async show({ bouncer, inertia, params }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'organizations.view')

    const details = await this.service.details(Number(params.id))

    return inertia.render('admin/organizations/show', {
      organization: new AdminOrganizationDetailTransformer(details).toObject(),
    })
  }
}
