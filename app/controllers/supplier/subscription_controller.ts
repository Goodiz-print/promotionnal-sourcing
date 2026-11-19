import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { urlFor } from '@adonisjs/core/services/url_builder'
import env from '#start/env'
import OrganizationContextService from '#services/organization_context_service'
import SubscriptionBillingService from '#services/subscription_billing_service'
import SubscriptionService from '#services/subscription_service'
import OrganizationSubscriptionTransformer from '#transformers/organization_subscription_transformer'
import {
  BillingPortalUnavailableException,
  SubscriptionAlreadyActiveException,
} from '#exceptions/subscription_errors'
import { subscriptionCheckoutValidator } from '#validators/subscription'
import type Organization from '#models/organization'
import type { SupplierSubscriptionPageProps } from '#shared/types/subscription'

/**
 * Tarifs et abonnement côté fournisseur (cf. `docs/abonnements.md`). La carte
 * est saisie sur les pages hébergées par Stripe ; la formule n'est accordée
 * qu'à la notification signée reçue par `StripeWebhookController`.
 */
@inject()
export default class SubscriptionController {
  constructor(
    private subscriptions: SubscriptionService,
    private billing: SubscriptionBillingService,
    private organizations: OrganizationContextService
  ) {}

  /** Page tarifs : formule courante, grille des formules, accès au portail. */
  async show(ctx: HttpContext) {
    const org = await this.authorize(ctx)
    const [current, portalAvailable] = await Promise.all([
      this.subscriptions.current(org.id),
      this.billing.hasBillingAccount(org.id),
    ])

    const checkout = ctx.request.qs().checkout
    const props: SupplierSubscriptionPageProps = {
      currentPlan: org.subscriptionPlan,
      subscription: current ? new OrganizationSubscriptionTransformer(current).toObject() : null,
      onlineEnabled: this.billing.enabled,
      portalAvailable: this.billing.enabled && portalAvailable,
      checkoutStatus: checkout === 'success' || checkout === 'cancelled' ? checkout : null,
    }
    return ctx.inertia.render('supplier/subscription/show', props)
  }

  /** Ouvre la page de souscription hébergée pour la formule choisie. */
  async checkout(ctx: HttpContext) {
    const org = await this.authorize(ctx)
    const { plan } = await ctx.request.validateUsing(subscriptionCheckoutValidator)

    if (!this.billing.enabled) {
      ctx.session.flash('error', ctx.i18n.t('subscription.flash.unavailable'))
      return ctx.response.redirect().back()
    }

    const back = this.pageUrl(ctx)
    try {
      const url = await this.billing.checkoutUrl(org, plan, {
        successUrl: `${back}?checkout=success`,
        cancelUrl: `${back}?checkout=cancelled`,
        fallbackEmail: ctx.auth.getUserOrFail().email,
      })
      // Page externe : visite complète du navigateur, pas une visite Inertia.
      return ctx.inertia.location(url)
    } catch (error) {
      if (!(error instanceof SubscriptionAlreadyActiveException)) throw error
      ctx.session.flash('error', ctx.i18n.t('subscription.flash.alreadySubscribed'))
      return ctx.response.redirect().back()
    }
  }

  /** Ouvre le portail de facturation Stripe (formule, résiliation, factures). */
  async portal(ctx: HttpContext) {
    const org = await this.authorize(ctx)

    if (!this.billing.enabled) {
      ctx.session.flash('error', ctx.i18n.t('subscription.flash.unavailable'))
      return ctx.response.redirect().back()
    }

    try {
      const url = await this.billing.portalUrl(org, this.pageUrl(ctx))
      return ctx.inertia.location(url)
    } catch (error) {
      if (!(error instanceof BillingPortalUnavailableException)) throw error
      ctx.session.flash('error', ctx.i18n.t('subscription.flash.noBillingAccount'))
      return ctx.response.redirect().back()
    }
  }

  private async authorize({ auth, bouncer }: HttpContext): Promise<Organization> {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canManageSubscription', org)
    return org
  }

  /** URL absolue de la page abonnement (retour des pages Stripe). */
  private pageUrl({ i18n }: HttpContext): string {
    const origin = new URL(env.get('APP_URL', 'http://localhost:5555')).origin
    return `${origin}${urlFor('supplier.subscription.show', { locale: i18n.locale })}`
  }
}
