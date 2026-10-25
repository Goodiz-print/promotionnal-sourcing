import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import OrganizationContextService from '#services/organization_context_service'
import QuoteService from '#services/quote_service'
import RfqService from '#services/rfq_service'
import QuoteTransformer from '#transformers/quote_transformer'
import SupplierRfqDetailTransformer from '#transformers/supplier_rfq_detail_transformer'
import { quoteValidator } from '#validators/quote'
import {
  QuoteAlreadyExistsException,
  QuoteInvalidItemsException,
  QuoteInvalidValidityException,
  QuoteNotAllowedException,
  QuoteNotEditableException,
  QuoteNotSubmittableException,
} from '#exceptions/quote_errors'
import type Organization from '#models/organization'
import type { Locale } from '#shared/types/i18n'

/**
 * Refus métier → clé de traduction. Une exception absente de cette table n'est
 * pas un cas attendu : elle remonte telle quelle.
 */
const QUOTE_ERRORS = [
  { type: QuoteNotAllowedException, key: 'quote.errors.notAllowed' },
  { type: QuoteAlreadyExistsException, key: 'quote.errors.alreadyExists' },
  { type: QuoteNotEditableException, key: 'quote.errors.notEditable' },
  { type: QuoteNotSubmittableException, key: 'quote.errors.notSubmittable' },
  { type: QuoteInvalidItemsException, key: 'quote.errors.invalidItems' },
  { type: QuoteInvalidValidityException, key: 'quote.errors.invalidValidity' },
] as const

/**
 * Devis rédigés par l'organisation fournisseuse. Controller fin :
 * organisation courante → autorisation (`canRespondToRfq`) → `QuoteService`.
 * Le cloisonnement est porté par le service (un devis d'une autre organisation
 * est un 404).
 */
@inject()
export default class SupplierQuotesController {
  constructor(
    private service: QuoteService,
    private rfqs: RfqService,
    private organizations: OrganizationContextService
  ) {}

  /**
   * Liste des devis de l'organisation, tous statuts confondus.
   */
  async index({ auth, bouncer, inertia }: HttpContext) {
    const org = await this.currentOrganization({ auth, bouncer })
    const quotes = await this.service.listForSupplier(org.id)

    return inertia.render('supplier/quotes/index', {
      quotes: quotes.map((quote) => new QuoteTransformer(quote).toObject()),
    })
  }

  /**
   * Formulaire d'un nouveau devis sur une demande reçue. Un devis vivant existe
   * déjà ? On y renvoie le fournisseur plutôt que d'en ouvrir un second.
   */
  async create({ auth, bouncer, inertia, params, response, i18n }: HttpContext) {
    const org = await this.currentOrganization({ auth, bouncer })
    const rfq = await this.rfqs.findForSupplier(Number(params.rfqId), org.id)

    const live = await this.service.findLiveForRfq(rfq.id, org.id)
    if (live) {
      return response.redirect().toRoute('supplier.quotes.show', {
        locale: i18n.locale,
        id: live.id,
      })
    }

    return inertia.render('supplier/quotes/edit', {
      rfq: new SupplierRfqDetailTransformer(rfq, i18n.locale as Locale).toObject(),
      quote: null,
      canEdit: this.rfqs.acceptsResponses(rfq),
    })
  }

  /**
   * Détail d'un devis : formulaire d'édition pour un brouillon, lecture seule
   * ensuite.
   */
  async show({ auth, bouncer, inertia, params, i18n }: HttpContext) {
    const org = await this.currentOrganization({ auth, bouncer })
    const quote = await this.service.findForSupplier(Number(params.id), org.id)
    const rfq = await this.rfqs.findForSupplier(quote.rfqId, org.id)

    return inertia.render('supplier/quotes/edit', {
      rfq: new SupplierRfqDetailTransformer(rfq, i18n.locale as Locale).toObject(),
      quote: new QuoteTransformer(quote).toObject(),
      canEdit: quote.status === 'draft' && this.rfqs.acceptsResponses(rfq),
    })
  }

  /**
   * Crée le brouillon puis atterrit dessus.
   */
  async store(ctx: HttpContext) {
    const { response, i18n, session, params } = ctx
    const org = await this.currentOrganization(ctx)
    const payload = await ctx.request.validateUsing(quoteValidator)

    try {
      const quote = await this.service.createDraft(Number(params.rfqId), org.id, payload)
      session.flash('success', i18n.t('quote.flash.created'))
      return response.redirect().toRoute('supplier.quotes.show', {
        locale: i18n.locale,
        id: quote.id,
      })
    } catch (error) {
      this.flashError(ctx, error)
      return response.redirect().back()
    }
  }

  /**
   * Met à jour un brouillon.
   */
  async update(ctx: HttpContext) {
    const org = await this.currentOrganization(ctx)
    const payload = await ctx.request.validateUsing(quoteValidator)
    const quote = await this.service.findForSupplier(Number(ctx.params.id), org.id)

    return this.run(ctx, quote.id, async () => {
      await this.service.updateDraft(quote, payload)
      ctx.session.flash('success', ctx.i18n.t('quote.flash.updated'))
    })
  }

  /**
   * Remet le devis à l'acheteur (il devient définitif).
   */
  async submit(ctx: HttpContext) {
    const org = await this.currentOrganization(ctx)
    const quote = await this.service.findForSupplier(Number(ctx.params.id), org.id)

    return this.run(ctx, quote.id, async () => {
      await this.service.submit(quote)
      ctx.session.flash('success', ctx.i18n.t('quote.flash.submitted'))
    })
  }

  /**
   * Supprime un brouillon.
   */
  async destroy(ctx: HttpContext) {
    const org = await this.currentOrganization(ctx)
    const quote = await this.service.findForSupplier(Number(ctx.params.id), org.id)

    try {
      await this.service.deleteDraft(quote)
    } catch (error) {
      this.flashError(ctx, error)
      return ctx.response
        .redirect()
        .toRoute('supplier.quotes.show', { locale: ctx.i18n.locale, id: quote.id })
    }

    ctx.session.flash('success', ctx.i18n.t('quote.flash.deleted'))
    return ctx.response.redirect().toRoute('supplier.quotes.index', { locale: ctx.i18n.locale })
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
   * Exécute une transition et retombe sur le devis ; un refus métier devient un
   * message flash.
   */
  private async run(ctx: HttpContext, quoteId: number, action: () => Promise<void>) {
    try {
      await action()
    } catch (error) {
      this.flashError(ctx, error)
    }
    return ctx.response
      .redirect()
      .toRoute('supplier.quotes.show', { locale: ctx.i18n.locale, id: quoteId })
  }

  private flashError({ i18n, session }: Pick<HttpContext, 'i18n' | 'session'>, error: unknown) {
    const known = QUOTE_ERRORS.find(({ type }) => error instanceof type)
    if (!known) throw error
    session.flash('error', i18n.t(known.key))
  }
}
