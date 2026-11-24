import Organization from '#models/organization'
import Product from '#models/product'
import Rfq from '#models/rfq'
import User from '#models/user'
import { inject } from '@adonisjs/core'
import AdminAgencyReviewService from '#services/admin_agency_review_service'
import AdminModerationService from '#services/admin_moderation_service'
import AdminSupplierLinkService from '#services/admin_supplier_link_service'
import type { AdminDashboardStats } from '#shared/types/admin'

/**
 * Compteurs du tableau de bord du back-office. Aucun filtre « organisation
 * vivante » sur les produits et les RFQ : le tableau de bord donne l'état brut
 * de la plateforme, pas la vue du catalogue public.
 */
@inject()
export default class AdminDashboardService {
  constructor(
    private moderation: AdminModerationService,
    private agencyReviews: AdminAgencyReviewService,
    private supplierLinks: AdminSupplierLinkService
  ) {}

  async stats(): Promise<AdminDashboardStats> {
    const [active, archived, users, products, rfqs, pending, agencies, links] = await Promise.all([
      Organization.query().whereNull('archivedAt').count('* as total').firstOrFail(),
      Organization.query().whereNotNull('archivedAt').count('* as total').firstOrFail(),
      User.query().count('* as total').firstOrFail(),
      Product.query().count('* as total').firstOrFail(),
      Rfq.query().count('* as total').firstOrFail(),
      this.moderation.pending(),
      this.agencyReviews.openCount(),
      this.supplierLinks.pendingCount(),
    ])

    return {
      organizations: Number(active.$extras.total),
      archivedOrganizations: Number(archived.$extras.total),
      users: Number(users.$extras.total),
      products: Number(products.$extras.total),
      rfqs: Number(rfqs.$extras.total),
      pendingModeration: pending.organization + pending.product,
      pendingAgencyReviews: agencies,
      pendingSupplierLinks: links,
    }
  }
}
