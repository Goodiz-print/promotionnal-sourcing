import { createHmac } from 'node:crypto'
import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import AdCampaign from '#models/ad_campaign'
import AdClick from '#models/ad_click'
import OrganizationUser from '#models/organization_user'
import type User from '#models/user'
import AdWalletService from '#services/ad_wallet_service'
import {
  AD_CLICK_DEDUP_HOURS,
  AD_MIN_CPC_CENTS,
  type AdPlacement,
  type AdUnbilledReason,
} from '#shared/types/ads'

/** Robots et préchargements : leurs « clics » ne sont ni comptés ni facturés. */
const BOT_USER_AGENT =
  /bot|crawl|spider|slurp|preview|scan|monitor|headless|curl|wget|python|httpclient|facebookexternalhit/i

/** Un clic reçu sur un lien de produit sponsorisé. */
export interface AdClickInput {
  campaignId: number
  /** La signature du lien est valide (prix et emplacement authentiques). */
  signed: boolean
  placement: AdPlacement
  /** Prix fixé par l'enchère au moment de l'affichage. */
  costCents: number
  user: User | null
  ip: string
  userAgent: string | null
}

/**
 * Enregistre et facture un clic sur un produit sponsorisé (cf. `docs/ads.md`).
 *
 * Un clic n'est **facturé** que s'il vient d'un lien signé, d'un vrai visiteur
 * qui n'a pas déjà cliqué sur cette campagne dans les dernières 24 h, qui
 * n'appartient ni à l'organisation annonceuse ni à l'équipe plateforme, et si la
 * campagne, son budget du jour et le portefeuille le permettent encore. Le débit
 * et la ligne de clic sont écrits dans la même transaction, portefeuille
 * verrouillé : deux clics simultanés ne peuvent pas dépasser le solde.
 *
 * Dans tous les cas, le visiteur est redirigé vers la fiche : la facturation ne
 * dégrade jamais la navigation.
 */
@inject()
export default class AdClickService {
  constructor(private wallets: AdWalletService) {}

  /**
   * Traite le clic et renvoie le slug du produit vers lequel rediriger, ou
   * `null` si la campagne n'existe plus.
   */
  async register(input: AdClickInput): Promise<string | null> {
    const campaign = await AdCampaign.query()
      .where('id', input.campaignId)
      .preload('product')
      .first()
    if (!campaign) return null

    const slug = campaign.product.slug
    // Lien altéré ou expiré, robot : on redirige sans rien compter.
    if (!input.signed || this.isBot(input.userAgent)) return slug

    const visitorHash = this.visitorHash(input)
    const reason =
      (await this.visitorReason(campaign, input.user)) ??
      (await this.duplicateReason(campaign.id, visitorHash))

    if (reason) {
      await this.recordUnbilled(campaign.id, input, visitorHash, reason)
      return slug
    }

    await this.bill(campaign, input, visitorHash)
    return slug
  }

  /** Débit et ligne de clic, dans une transaction, portefeuille verrouillé. */
  private async bill(campaign: AdCampaign, input: AdClickInput, visitorHash: string) {
    await db.transaction(async (trx) => {
      const wallet = await this.wallets.lock(campaign.organizationId, trx)
      // Relue sous verrou : la campagne a pu être modifiée depuis l'affichage.
      const fresh = await AdCampaign.query({ client: trx }).where('id', campaign.id).firstOrFail()
      const cost = Math.max(AD_MIN_CPC_CENTS, Math.min(input.costCents, fresh.maxCpcCents))
      const now = DateTime.now()

      const spentToday = await AdClick.query({ client: trx })
        .where('campaignId', fresh.id)
        .where('billed', true)
        .where('createdAt', '>=', now.startOf('day').toSQL()!)
        .sum('cost_cents as total')
        .first()

      let reason: AdUnbilledReason | null = null
      if (!this.isRunning(fresh, now)) reason = 'inactive'
      else if (Number(spentToday?.$extras.total ?? 0) + cost > fresh.dailyBudgetCents) {
        reason = 'budget'
      } else if (wallet.balanceCents < cost) reason = 'insufficient_funds'

      if (!reason) {
        await this.wallets.post(wallet, -cost, { type: 'click', campaignId: fresh.id }, trx)
      }

      await AdClick.create(
        {
          campaignId: fresh.id,
          placement: input.placement,
          visitorHash,
          userId: input.user?.id ?? null,
          costCents: reason ? 0 : cost,
          billed: !reason,
          unbilledReason: reason,
        },
        { client: trx }
      )
    })
  }

  private async recordUnbilled(
    campaignId: number,
    input: AdClickInput,
    visitorHash: string,
    reason: AdUnbilledReason
  ) {
    await AdClick.create({
      campaignId,
      placement: input.placement,
      visitorHash,
      userId: input.user?.id ?? null,
      costCents: 0,
      billed: false,
      unbilledReason: reason,
    })
  }

  /** Clic de l'équipe plateforme ou d'un membre de l'organisation annonceuse. */
  private async visitorReason(
    campaign: AdCampaign,
    user: User | null
  ): Promise<AdUnbilledReason | null> {
    if (!user) return null
    if (user.hasBackOffice) return 'staff'

    const member = await OrganizationUser.query()
      .where('userId', user.id)
      .where('organizationId', campaign.organizationId)
      .first()
    return member ? 'own_organization' : null
  }

  /** Le même visiteur a déjà cliqué sur cette campagne récemment. */
  private async duplicateReason(
    campaignId: number,
    visitorHash: string
  ): Promise<AdUnbilledReason | null> {
    const previous = await AdClick.query()
      .where('campaignId', campaignId)
      .where('visitorHash', visitorHash)
      .where('createdAt', '>=', DateTime.now().minus({ hours: AD_CLICK_DEDUP_HOURS }).toSQL()!)
      .first()
    return previous ? 'duplicate' : null
  }

  private isRunning(campaign: AdCampaign, now: DateTime): boolean {
    const today = now.toISODate()!
    if (campaign.status !== 'active') return false
    if (campaign.startsOn.toISODate()! > today) return false
    return !campaign.endsOn || campaign.endsOn.toISODate()! >= today
  }

  private isBot(userAgent: string | null): boolean {
    return !userAgent || BOT_USER_AGENT.test(userAgent)
  }

  /**
   * Empreinte du visiteur : le compte s'il est connecté, sinon l'adresse IP et
   * le navigateur. HMAC avec la clé de l'application — l'adresse IP n'est
   * jamais conservée et l'empreinte n'est pas réversible.
   */
  private visitorHash(input: AdClickInput): string {
    const identity = input.user ? `user:${input.user.id}` : `${input.ip}|${input.userAgent ?? ''}`
    return createHmac('sha256', env.get('APP_KEY').release()).update(identity).digest('hex')
  }
}
