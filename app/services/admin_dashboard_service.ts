import Organization from '#models/organization'
import Product from '#models/product'
import Rfq from '#models/rfq'
import User from '#models/user'
import type { AdminDashboardStats } from '#shared/types/admin'

/**
 * Compteurs du tableau de bord du back-office. Aucun filtre « organisation
 * vivante » sur les produits et les RFQ : le tableau de bord donne l'état brut
 * de la plateforme, pas la vue du catalogue public.
 */
export default class AdminDashboardService {
  async stats(): Promise<AdminDashboardStats> {
    const [active, archived, users, products, rfqs] = await Promise.all([
      Organization.query().whereNull('archivedAt').count('* as total').firstOrFail(),
      Organization.query().whereNotNull('archivedAt').count('* as total').firstOrFail(),
      User.query().count('* as total').firstOrFail(),
      Product.query().count('* as total').firstOrFail(),
      Rfq.query().count('* as total').firstOrFail(),
    ])

    return {
      organizations: Number(active.$extras.total),
      archivedOrganizations: Number(archived.$extras.total),
      users: Number(users.$extras.total),
      products: Number(products.$extras.total),
      rfqs: Number(rfqs.$extras.total),
    }
  }
}
