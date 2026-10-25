import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import OrderService from '#services/order_service'
import OrganizationContextService from '#services/organization_context_service'
import OrderTransformer from '#transformers/order_transformer'
import { OrderTransitionException } from '#exceptions/order_errors'
import type Organization from '#models/organization'
import type { OrderAction } from '#shared/types/order'

/**
 * Commandes, côté **fournisseur** : l'organisation les fait avancer (confirmer,
 * lancer la production, expédier) ou les annule. Tout passe par
 * `canRespondToRfq`, comme les devis. La commande d'une autre organisation est
 * un 404.
 */
@inject()
export default class SupplierOrdersController {
  constructor(
    private service: OrderService,
    private organizations: OrganizationContextService
  ) {}

  /**
   * Commandes reçues, avec l'action suivante de chacune.
   */
  async index({ auth, bouncer, inertia }: HttpContext) {
    const org = await this.currentOrganization({ auth, bouncer })

    const orders = await this.service.listFor('supplier', org.id)
    return inertia.render('supplier/orders/index', {
      orders: orders.map((order) =>
        new OrderTransformer(
          order,
          this.service.availableActions(order, 'supplier'),
          'supplier'
        ).toObject()
      ),
    })
  }

  /**
   * Détail d'une commande reçue.
   */
  async show({ auth, bouncer, inertia, params }: HttpContext) {
    const org = await this.currentOrganization({ auth, bouncer })

    const order = await this.service.findFor('supplier', Number(params.id), org.id)
    return inertia.render('supplier/orders/show', {
      order: new OrderTransformer(
        order,
        this.service.availableActions(order, 'supplier'),
        'supplier'
      ).toObject(),
    })
  }

  /**
   * Confirme la commande : le fournisseur s'engage à la honorer.
   */
  async confirm(ctx: HttpContext) {
    return this.run(ctx, 'confirm')
  }

  /**
   * Lance la production.
   */
  async produce(ctx: HttpContext) {
    return this.run(ctx, 'startProduction')
  }

  /**
   * Marque la commande expédiée.
   */
  async ship(ctx: HttpContext) {
    return this.run(ctx, 'ship')
  }

  /**
   * Annule la commande avant sa mise en production.
   */
  async cancel(ctx: HttpContext) {
    return this.run(ctx, 'cancel')
  }

  private async currentOrganization({
    auth,
    bouncer,
  }: Pick<HttpContext, 'auth' | 'bouncer'>): Promise<Organization> {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canRespondToRfq', org)
    return org
  }

  /**
   * Exécute une transition et retombe sur la commande ; un refus métier devient
   * un message flash.
   */
  private async run(ctx: HttpContext, action: OrderAction) {
    const { params, response, i18n, session } = ctx
    const org = await this.currentOrganization(ctx)
    const order = await this.service.findFor('supplier', Number(params.id), org.id)

    try {
      await this.service.transition(order, action, 'supplier')
      session.flash('success', i18n.t(`order.flash.${action}`))
    } catch (error) {
      if (!(error instanceof OrderTransitionException)) throw error
      session.flash('error', i18n.t('order.errors.transition'))
    }

    return response
      .redirect()
      .toRoute('supplier.orders.show', { locale: i18n.locale, id: order.id })
  }
}
