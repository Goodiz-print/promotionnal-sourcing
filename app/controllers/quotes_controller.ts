import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import OrganizationContextService from '#services/organization_context_service'
import QuoteService from '#services/quote_service'
import QuoteTransformer from '#transformers/quote_transformer'
import { QuoteNotDecidableException } from '#exceptions/quote_errors'

/**
 * Devis reçus, côté **acheteur**. Consulter demande `canCreateRfq`, décider
 * (accepter / rejeter) demande `canManageRfq` — les mêmes niveaux que les
 * demandes elles-mêmes. Le devis d'une autre organisation, ou un brouillon, est
 * un 404 (cf. `QuoteService#findForBuyer`).
 */
@inject()
export default class QuotesController {
  constructor(
    private service: QuoteService,
    private organizations: OrganizationContextService
  ) {}

  /**
   * Détail d'un devis, avec les actions de décision quand elles s'appliquent.
   */
  async show({ auth, bouncer, inertia, params }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canCreateRfq', org)

    const quote = await this.service.findForBuyer(Number(params.id), org.id)

    return inertia.render('quotes/show', {
      quote: new QuoteTransformer(quote).toObject(),
      canDecide:
        quote.status === 'submitted' &&
        quote.rfq.status === 'published' &&
        (await bouncer.allows('canManageRfq', org)),
    })
  }

  /**
   * Accepte le devis : les autres devis remis sont rejetés, la demande est
   * clôturée.
   */
  async accept(ctx: HttpContext) {
    return this.decide(ctx, 'accept')
  }

  /**
   * Rejette le devis, sans clore la demande.
   */
  async reject(ctx: HttpContext) {
    return this.decide(ctx, 'reject')
  }

  private async decide(
    { auth, bouncer, params, response, i18n, session }: HttpContext,
    decision: 'accept' | 'reject'
  ) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canManageRfq', org)

    const quote = await this.service.findForBuyer(Number(params.id), org.id)

    try {
      if (decision === 'accept') await this.service.accept(quote)
      else await this.service.reject(quote)
      session.flash(
        'success',
        i18n.t(`quote.flash.${decision === 'accept' ? 'accepted' : 'rejected'}`)
      )
    } catch (error) {
      if (!(error instanceof QuoteNotDecidableException)) throw error
      session.flash('error', i18n.t('quote.errors.notDecidable'))
    }

    return response.redirect().toRoute('quotes.show', { locale: i18n.locale, id: quote.id })
  }
}
