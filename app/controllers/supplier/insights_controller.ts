import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import OrganizationContextService from '#services/organization_context_service'
import SubscriptionService from '#services/subscription_service'
import SupplierInsightsService from '#services/supplier_insights_service'
import { supplierInsightsQueryValidator } from '#validators/supplier_insights'
import { subscriptionUpsell } from '#shared/helpers/subscription'
import {
  SUPPLIER_INSIGHTS_DEFAULT_PERIOD,
  type SupplierInsightsPageProps,
  type SupplierInsightsPeriod,
} from '#shared/types/supplier_insights'

/**
 * « Consultations » de l'espace fournisseur (#239) : compteurs pour tous, liste
 * des agences pour un abonné. La règle « abonné » est évaluée à chaque lecture
 * (`SubscriptionService.isSubscribed`) ; pour un non abonné, le service ne lit
 * même pas les agences et la page reçoit l'encart d'abonnement (#222).
 */
@inject()
export default class SupplierInsightsController {
  constructor(
    private insights: SupplierInsightsService,
    private subscriptions: SubscriptionService,
    private organizations: OrganizationContextService
  ) {}

  /** Une période ou une page invalide est ignorée : c'est une URL, pas une saisie. */
  async index({ auth, bouncer, inertia, request, i18n }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canViewSupplierInsights', org)

    const [, query] = await supplierInsightsQueryValidator.tryValidate(request.qs())
    const period = (query?.period ?? SUPPLIER_INSIGHTS_DEFAULT_PERIOD) as SupplierInsightsPeriod
    const subscribed = await this.subscriptions.isSubscribed(org.id)
    const report = await this.insights.report(org.id, {
      period,
      page: query?.page ?? 1,
      locale: i18n.locale,
      revealAgencies: subscribed,
    })

    const props: SupplierInsightsPageProps = {
      period,
      report,
      canEditProducts: await bouncer.allows('canManageProducts', org),
      upsell: await subscriptionUpsell(subscribed, () =>
        bouncer.allows('canManageSubscription', org)
      ),
    }
    return inertia.render('supplier/insights/index', props)
  }
}
