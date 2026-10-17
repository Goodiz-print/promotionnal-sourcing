import Organization from '#models/organization'
import OrganizationUser from '#models/organization_user'
import Product from '#models/product'
import Rfq from '#models/rfq'
import { AdminOrganizationNotFoundException } from '#exceptions/admin_errors'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type { AdminOrganizationFilters } from '#shared/types/admin'

interface ListOptions extends AdminOrganizationFilters {
  page: number
  perPage: number
}

export interface AdminOrganizationDetails {
  organization: Organization
  members: OrganizationUser[]
  productsCount: number
  rfqsCount: number
}

/**
 * Consultation des organisations par l'équipe plateforme : toutes les
 * organisations, archivées comprises (contrairement aux écrans publics).
 */
export default class AdminOrganizationService {
  /**
   * Liste paginée, filtrable par type et par statut d'archivage, avec le nombre
   * de membres (`$extras.members_count`). Les plus récentes d'abord.
   */
  list(options: ListOptions): Promise<ModelPaginatorContract<Organization>> {
    const { page, perPage, type, status } = options

    return Organization.query()
      .withCount('organizationUsers', (query) => query.as('members_count'))
      .if(type, (query) => query.where('organizationType', type!))
      .if(status === 'active', (query) => query.whereNull('archivedAt'))
      .if(status === 'archived', (query) => query.whereNotNull('archivedAt'))
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .paginate(page, perPage)
  }

  /**
   * Fiche d'une organisation : membres (utilisateur + rôle) et volumes de
   * produits et de demandes de devis. Lève si l'id n'existe pas.
   */
  async details(id: number): Promise<AdminOrganizationDetails> {
    const organization = await Organization.query()
      .where('id', id)
      .withCount('organizationUsers', (query) => query.as('members_count'))
      .first()
    if (!organization) throw new AdminOrganizationNotFoundException()

    const [members, products, rfqs] = await Promise.all([
      OrganizationUser.query()
        .where('organizationId', id)
        .preload('user')
        .preload('role')
        .orderBy('joinedAt', 'asc'),
      Product.query()
        .whereHas('supplier', (supplier) => supplier.where('organizationId', id))
        .count('* as total')
        .firstOrFail(),
      Rfq.query().where('buyerOrganizationId', id).count('* as total').firstOrFail(),
    ])

    return {
      organization,
      members,
      productsCount: Number(products.$extras.total),
      rfqsCount: Number(rfqs.$extras.total),
    }
  }
}
