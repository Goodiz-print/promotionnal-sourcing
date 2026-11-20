import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import RfqSent from '#events/rfq_sent'
import ActivityEventService from '#services/activity_event_service'
import OrganizationContextService from '#services/organization_context_service'
import QuoteCartService from '#services/quote_cart_service'
import {
  quoteCartCheckoutValidator,
  quoteCartItemUpdateValidator,
  quoteCartItemValidator,
} from '#validators/quote_cart'
import {
  QuoteCartDuplicateLineException,
  QuoteCartEmptyException,
  QuoteCartInvalidOptionException,
} from '#exceptions/quote_cart_errors'
import { NotASupplierOrganizationException } from '#exceptions/rfq_errors'
import type { Locale } from '#shared/types/i18n'

/**
 * Panier de devis de l'acheteur connecté (cf. `docs/quote-cart.md`). Controller
 * fin : organisation courante + `canCreateRfq` → `QuoteCartService`.
 *
 * La validation crée une demande par fournisseur : envoyées si l'utilisateur
 * peut envoyer des demandes (`canSendRfq`, jusqu'au rôle `member`, #216),
 * en brouillon sinon.
 */
@inject()
export default class QuoteCartController {
  constructor(
    private service: QuoteCartService,
    private organizations: OrganizationContextService,
    private activityEvents: ActivityEventService
  ) {}

  async show({ auth, bouncer, inertia, i18n }: HttpContext) {
    const { user, org } = await this.context({ auth, bouncer })

    return inertia.render('quote_cart/show', {
      groups: await this.service.list(user, org, i18n.locale as Locale),
      canSend: await bouncer.allows('canSendRfq', org),
    })
  }

  async store({ auth, bouncer, request, response, session, i18n }: HttpContext) {
    const { user, org } = await this.context({ auth, bouncer })
    const payload = await request.validateUsing(quoteCartItemValidator)

    let added
    try {
      added = await this.service.add(user, org, payload)
    } catch (error) {
      if (error instanceof QuoteCartInvalidOptionException) {
        session.flash('error', i18n.t('quote_cart.errors.invalidOption'))
        return response.redirect().back()
      }
      throw error
    }
    const { product, created } = added
    if (created) {
      await this.activityEvents.record({
        type: 'rfq_product_added',
        targetType: 'product',
        targetId: product.id,
        userId: user.id,
        organizationId: org.id,
        isStaff: false,
      })
    }

    session.flash(
      'success',
      i18n.t(created ? 'quote_cart.flash.added' : 'quote_cart.flash.alreadyInCart')
    )
    return response.redirect().back()
  }

  async update({ auth, bouncer, params, request, response, session, i18n }: HttpContext) {
    const { user, org } = await this.context({ auth, bouncer })
    const payload = await request.validateUsing(quoteCartItemUpdateValidator)

    try {
      await this.service.updateItem(user, org, Number(params.id), payload)
    } catch (error) {
      if (error instanceof QuoteCartInvalidOptionException) {
        session.flash('error', i18n.t('quote_cart.errors.invalidOption'))
        return response.redirect().back()
      }
      if (error instanceof QuoteCartDuplicateLineException) {
        session.flash('error', i18n.t('quote_cart.errors.duplicateLine'))
        return response.redirect().back()
      }
      throw error
    }
    return response.redirect().back()
  }

  async destroy({ auth, bouncer, params, response, session, i18n }: HttpContext) {
    const { user, org } = await this.context({ auth, bouncer })

    await this.service.removeItem(user, org, Number(params.id))
    session.flash('success', i18n.t('quote_cart.flash.removed'))
    return response.redirect().back()
  }

  /**
   * Éclate le panier en demandes, puis — transaction commitée — notifie les
   * fournisseurs (`RfqSent` : mail + notification in-app), comme l'envoi
   * d'une demande depuis son écran.
   */
  async checkout({ auth, bouncer, request, response, session, i18n }: HttpContext) {
    const { user, org } = await this.context({ auth, bouncer })
    const payload = await request.validateUsing(quoteCartCheckoutValidator)
    const send = await bouncer.allows('canSendRfq', org)

    let outcomes
    try {
      outcomes = await this.service.checkout(user, org, payload, {
        send,
        locale: i18n.locale as Locale,
      })
    } catch (error) {
      if (error instanceof QuoteCartEmptyException) {
        session.flash('error', i18n.t('quote_cart.errors.empty'))
        return response.redirect().back()
      }
      if (error instanceof NotASupplierOrganizationException) {
        session.flash('error', i18n.t('quote_cart.errors.supplierUnavailable'))
        return response.redirect().back()
      }
      throw error
    }

    for (const { rfq, recipients } of outcomes) {
      if (recipients.length === 0) continue
      await emitter.emit(RfqSent, new RfqSent(rfq, org, recipients))
      await this.activityEvents.record({
        type: 'rfq_sent',
        targetType: 'rfq',
        targetId: rfq.id,
        userId: user.id,
        organizationId: org.id,
        isStaff: false,
      })
    }

    session.flash(
      'success',
      i18n.t(send ? 'quote_cart.flash.sent' : 'quote_cart.flash.drafted', {
        count: outcomes.length,
      })
    )
    return response.redirect().toRoute('rfqs.index', { locale: i18n.locale })
  }

  private async context({ auth, bouncer }: Pick<HttpContext, 'auth' | 'bouncer'>) {
    const user = auth.getUserOrFail()
    const org = await this.organizations.currentFor(user)
    await bouncer.authorize('canCreateRfq', org)
    return { user, org }
  }
}
