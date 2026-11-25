import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { urlFor } from '@adonisjs/core/services/url_builder'
import env from '#start/env'
import AdTopUpService from '#services/ad_top_up_service'
import OrganizationContextService from '#services/organization_context_service'
import { adTopUpValidator } from '#validators/ads'
import { eurosToCents } from '#shared/helpers/ad_money'

/**
 * Recharge en ligne du portefeuille publicitaire (cf. `docs/ads.md`). La carte
 * est saisie sur la page hébergée par le prestataire ; le solde n'est crédité
 * qu'à la confirmation signée reçue par `StripeWebhookController`.
 */
@inject()
export default class AdWalletController {
  constructor(
    private topUps: AdTopUpService,
    private organizations: OrganizationContextService
  ) {}

  async topUp({ auth, bouncer, request, response, inertia, session, i18n }: HttpContext) {
    const user = auth.getUserOrFail()
    const org = await this.organizations.currentFor(user)
    await bouncer.authorize('canManageAds', org)

    const { amount } = await request.validateUsing(adTopUpValidator)

    if (!this.topUps.enabled) {
      session.flash('error', i18n.t('ads.flash.topUpUnavailable'))
      return response.redirect().back()
    }

    const origin = new URL(env.get('APP_URL', 'http://localhost:5555')).origin
    const back = `${origin}${urlFor('supplier.ads.index', { locale: i18n.locale })}`
    const url = await this.topUps.checkoutUrl({
      organizationId: org.id,
      amountCents: eurosToCents(amount),
      label: i18n.t('ads.wallet.checkoutLabel', { organization: org.name }),
      customerEmail: user.email,
      successUrl: `${back}?topUp=success`,
      cancelUrl: `${back}?topUp=cancelled`,
    })

    // Page externe : visite complète du navigateur, pas une visite Inertia.
    return inertia.location(url)
  }
}
