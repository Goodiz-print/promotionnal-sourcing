import db from '@adonisjs/lucid/services/db'
import Product from '#models/product'
import Rfq from '#models/rfq'
import RfqSupplier from '#models/rfq_supplier'
import SupplierProfile from '#models/supplier_profile'
import { RFQ_STATUSES } from '#shared/types/rfq'
import type Organization from '#models/organization'
import type {
  BuyerDashboardType,
  BuyerRfqCountsType,
  DashboardType,
  SupplierDashboardType,
} from '#shared/types/dashboard'

const RECENT_RESPONSES_LIMIT = 5

/**
 * Données du tableau de bord de l'organisation courante. Un bloc par rôle
 * métier : une organisation `both` reçoit les deux.
 */
export default class DashboardService {
  async forOrganization(organization: Organization): Promise<DashboardType> {
    const { organizationType } = organization
    const wantsBuyer = organizationType === 'buyer' || organizationType === 'both'
    const wantsSupplier = organizationType === 'supplier' || organizationType === 'both'

    const [buyer, supplier] = await Promise.all([
      wantsBuyer ? this.buyerBlock(organization.id) : undefined,
      wantsSupplier ? this.supplierBlock(organization.id) : undefined,
    ])

    return { ...(buyer && { buyer }), ...(supplier && { supplier }) }
  }

  private async buyerBlock(organizationId: number): Promise<BuyerDashboardType> {
    const [counts, responses] = await Promise.all([
      Rfq.query()
        .where('buyerOrganizationId', organizationId)
        .select('status')
        .count('* as total')
        .groupBy('status'),
      RfqSupplier.query()
        .where('status', 'responded')
        .whereHas('rfq', (query) => query.where('buyerOrganizationId', organizationId))
        .preload('rfq')
        .preload('supplierOrganization')
        .orderBy('updatedAt', 'desc')
        .limit(RECENT_RESPONSES_LIMIT),
    ])

    const rfqCounts = Object.fromEntries(
      RFQ_STATUSES.map((status) => [status, 0])
    ) as BuyerRfqCountsType
    for (const row of counts) {
      rfqCounts[row.status as keyof BuyerRfqCountsType] = Number(row.$extras.total)
    }

    return {
      rfqCounts,
      recentResponses: responses.map((response) => ({
        rfqId: response.rfqId,
        rfqTitle: response.rfq.title,
        supplierName: response.supplierOrganization.name,
        respondedAt: (response.updatedAt ?? response.createdAt).toISO()!,
      })),
    }
  }

  private async supplierBlock(organizationId: number): Promise<SupplierDashboardType> {
    const [unread, products, profile] = await Promise.all([
      RfqSupplier.query()
        .where('supplierOrganizationId', organizationId)
        .where('status', 'sent')
        .count('* as total')
        .firstOrFail(),
      Product.query()
        .where('isActive', true)
        .whereIn(
          'supplierId',
          db.from('suppliers').where('organization_id', organizationId).select('id')
        )
        .count('* as total')
        .firstOrFail(),
      SupplierProfile.findBy('organizationId', organizationId),
    ])

    return {
      unreadRfqs: Number(unread.$extras.total),
      activeProducts: Number(products.$extras.total),
      profileCompleteness: this.completeness(profile),
    }
  }

  /** Part des champs du profil fournisseur renseignés, en pourcentage entier. */
  private completeness(profile: SupplierProfile | null): number {
    if (!profile) return 0

    const filled = [
      profile.bio,
      profile.deliveryScope,
      profile.deliveryDays,
      profile.minOrderQuantity,
      profile.responseTimeDays,
      Array.isArray(profile.certifications) ? profile.certifications.length || null : null,
    ].filter((value) => value !== null && value !== undefined && value !== '')

    return Math.round((filled.length / 6) * 100)
  }
}
