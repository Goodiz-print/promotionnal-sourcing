import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import { adminActionContext } from '#services/admin_audit_service'
import AdminSubscriptionService from '#services/admin_subscription_service'
import {
  InvalidSubscriptionPeriodException,
  SubscriptionAlreadyOpenException,
  SubscriptionNotEditableException,
  SubscriptionNotSupplierException,
} from '#exceptions/subscription_errors'
import {
  adminSubscriptionCreateValidator,
  adminSubscriptionExtendValidator,
} from '#validators/admin_subscription'
import type { ManualSubscriptionTarget } from '#shared/types/subscription'

/** Erreur métier → clé de message flash (`admin.organizations.subscription.errors.*`). */
const ERROR_KEYS = new Map<typeof Exception, string>([
  [SubscriptionAlreadyOpenException, 'alreadyOpen'],
  [InvalidSubscriptionPeriodException, 'invalidPeriod'],
  [SubscriptionNotEditableException, 'notEditable'],
  [SubscriptionNotSupplierException, 'notSupplier'],
])

/** Abonnement visé par l'URL `admin/organizations/:id/subscriptions/:subscriptionId`. */
const target = (params: HttpContext['params']): ManualSubscriptionTarget => ({
  organizationId: Number(params.id),
  subscriptionId: Number(params.subscriptionId),
})

/**
 * Abonnement manuel d'une organisation fournisseur saisi par l'équipe
 * plateforme (#214) : création datée, prolongation, résiliation. Droit
 * `organizations.manage`.
 */
@inject()
export default class OrganizationSubscriptionController {
  constructor(private subscriptions: AdminSubscriptionService) {}

  async store(ctx: HttpContext) {
    const { bouncer, request, params, auth } = ctx
    await bouncer.authorize('hasPlatformPermission', 'organizations.manage')
    const data = await request.validateUsing(adminSubscriptionCreateValidator)

    return this.respond(ctx, 'created', () =>
      this.subscriptions.create(
        { ...data, organizationId: Number(params.id), authorId: auth.getUserOrFail().id },
        adminActionContext(ctx)
      )
    )
  }

  async extend(ctx: HttpContext) {
    const { bouncer, request, params } = ctx
    await bouncer.authorize('hasPlatformPermission', 'organizations.manage')
    const { endsOn } = await request.validateUsing(adminSubscriptionExtendValidator)

    return this.respond(ctx, 'extended', () =>
      this.subscriptions.extend({ ...target(params), endsOn }, adminActionContext(ctx))
    )
  }

  async cancel(ctx: HttpContext) {
    const { bouncer, params } = ctx
    await bouncer.authorize('hasPlatformPermission', 'organizations.manage')

    return this.respond(ctx, 'cancelled', () =>
      this.subscriptions.cancel(target(params), adminActionContext(ctx))
    )
  }

  /** Exécute l'action puis redirige avec un message ; une erreur métier devient un flash. */
  private async respond(
    { response, session, i18n }: HttpContext,
    done: string,
    action: () => Promise<unknown>
  ) {
    try {
      await action()
    } catch (error) {
      const key = ERROR_KEYS.get((error as Exception).constructor as typeof Exception)
      if (!key) throw error
      session.flash('error', i18n.t(`admin.organizations.subscription.errors.${key}`))
      return response.redirect().back()
    }
    session.flash('success', i18n.t(`admin.organizations.subscription.done.${done}`))
    return response.redirect().back()
  }
}
