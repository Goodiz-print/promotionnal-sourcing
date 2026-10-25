import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import OrderService from '#services/order_service'
import OrganizationContextService from '#services/organization_context_service'
import OrderTransformer from '#transformers/order_transformer'
import { OrderTransitionException } from '#exceptions/order_errors'
import type Order from '#models/order'
import type { OrderAction } from '#shared/types/order'

/**
 * Commandes, côté **acheteur**. Consulter demande `canCreateRfq`, agir
 * (confirmer la réception, annuler) demande `canManageRfq` — les mêmes niveaux
 * que les devis. La commande d'une autre organisation est un 404.
 */
@inject()
export default class OrdersController {
  constructor(
    private service: OrderService,
    private organizations: OrganizationContextService
  ) {}

  /**
   * Historique des commandes de l'organisation.
   */
  async index({ auth, bouncer, inertia }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canCreateRfq', org)

    const orders = await this.service.listFor('buyer', org.id)
    return inertia.render('orders/index', {
      orders: orders.map((order) => new OrderTransformer(order).toObject()),
    })
  }

  /**
   * Détail d'une commande, avec sa frise de statuts et les actions ouvertes.
   */
  async show({ auth, bouncer, inertia, params }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canCreateRfq', org)

    const order = await this.service.findFor('buyer', Number(params.id), org.id)
    const canAct = await bouncer.allows('canManageRfq', org)

    return inertia.render('orders/show', {
      order: new OrderTransformer(
        order,
        canAct ? this.service.availableActions(order, 'buyer') : [],
        'buyer'
      ).toObject(),
    })
  }

  /**
   * L'acheteur confirme avoir reçu la commande.
   */
  async deliver(ctx: HttpContext) {
    return this.run(ctx, 'deliver')
  }

  /**
   * L'acheteur annule la commande avant sa mise en production.
   */
  async cancel(ctx: HttpContext) {
    return this.run(ctx, 'cancel')
  }

  private async run(
    { auth, bouncer, params, response, i18n, session }: HttpContext,
    action: OrderAction
  ) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canManageRfq', org)

    const order: Order = await this.service.findFor('buyer', Number(params.id), org.id)

    try {
      await this.service.transition(order, action, 'buyer')
      session.flash('success', i18n.t(`order.flash.${action}`))
    } catch (error) {
      if (!(error instanceof OrderTransitionException)) throw error
      session.flash('error', i18n.t('order.errors.transition'))
    }

    return response.redirect().toRoute('orders.show', { locale: i18n.locale, id: order.id })
  }
}
