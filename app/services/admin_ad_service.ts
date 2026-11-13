import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import AdCampaign from '#models/ad_campaign'
import Organization from '#models/organization'
import AdminAuditService from '#services/admin_audit_service'
import AdWalletService from '#services/ad_wallet_service'
import { AdCampaignNotFoundException } from '#exceptions/ad_errors'
import { AdminOrganizationNotFoundException } from '#exceptions/admin_errors'
import type { AdminActionContext } from '#shared/types/admin_audit'

/**
 * Actions de l'équipe plateforme sur les produits sponsorisés (cf.
 * `docs/ads.md`) : suspension d'une campagne, ajustement manuel d'un
 * portefeuille. Chaque action est auditée **dans la même transaction**.
 */
@inject()
export default class AdminAdService {
  constructor(
    private wallets: AdWalletService,
    private audit: AdminAuditService
  ) {}

  /**
   * Suspend une campagne (elle cesse de diffuser et le fournisseur ne peut pas
   * la relancer) ou lève la suspension (elle revient en pause).
   */
  async setSuspended(
    campaignId: number,
    suspended: boolean,
    context: AdminActionContext
  ): Promise<void> {
    await db.transaction(async (trx) => {
      const campaign = await AdCampaign.query({ client: trx })
        .where('id', campaignId)
        .forUpdate()
        .first()
      if (!campaign) throw new AdCampaignNotFoundException()

      const before = campaign.status
      const after = suspended ? 'suspended' : 'paused'
      if (before === after || (!suspended && before !== 'suspended')) return

      campaign.useTransaction(trx)
      await campaign.merge({ status: after }).save()

      await this.audit.record(
        {
          action: suspended ? 'ad_campaign.suspended' : 'ad_campaign.restored',
          targetType: 'ad_campaign',
          targetId: campaign.id,
          changes: { before: { status: before }, after: { status: after } },
        },
        { ...context, client: trx }
      )
    })
  }

  /**
   * Crédite (ou débite) le portefeuille d'une organisation : geste commercial,
   * paiement reçu hors plateforme, correction. Lève
   * `InsufficientAdFundsException` si un débit dépasse le solde.
   */
  async adjustWallet(
    organizationId: number,
    amountCents: number,
    note: string,
    context: AdminActionContext
  ): Promise<void> {
    await db.transaction(async (trx) => {
      const organization = await Organization.find(organizationId, { client: trx })
      if (!organization) throw new AdminOrganizationNotFoundException()

      const wallet = await this.wallets.lock(organization.id, trx)
      const before = wallet.balanceCents
      const transaction = await this.wallets.post(
        wallet,
        amountCents,
        { type: 'adjustment', note, actorId: context.actor?.id ?? null },
        trx
      )

      await this.audit.record(
        {
          action: 'ad_wallet.adjusted',
          targetType: 'organization',
          targetId: organization.id,
          changes: {
            before: { balanceCents: before },
            after: { balanceCents: transaction.balanceAfterCents },
          },
        },
        { ...context, client: trx }
      )
    })
  }
}
