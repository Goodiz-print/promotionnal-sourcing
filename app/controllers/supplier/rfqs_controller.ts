import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import RfqDeclined from '#events/rfq_declined'
import OrganizationContextService from '#services/organization_context_service'
import QuoteService from '#services/quote_service'
import RfqService from '#services/rfq_service'
import SupplierRfqDetailTransformer from '#transformers/supplier_rfq_detail_transformer'
import SupplierRfqTransformer from '#transformers/supplier_rfq_transformer'
import { RfqNotEditableException } from '#exceptions/rfq_errors'
import type { Locale } from '#shared/types/i18n'

/**
 * Demandes de devis **reçues**, côté fournisseur. Symétrique de
 * `RfqsController` : organisation courante → autorisation (`canRespondToRfq`)
 * → `RfqService`.
 *
 * Le cloisonnement est porté par le service : `listForSupplier` et
 * `findForSupplier` filtrent sur l'organisation destinataire **et** excluent
 * les lignes encore `pending`. Une demande qu'un acheteur a préparée sans
 * l'envoyer n'existe donc pas ici, et une demande adressée à quelqu'un d'autre
 * est un 404 — pas un 403, qui confirmerait son existence.
 */
@inject()
export default class SupplierRfqsController {
  constructor(
    private service: RfqService,
    private quotes: QuoteService,
    private organizations: OrganizationContextService
  ) {}

  /**
   * Liste des demandes reçues, la plus récemment publiée en tête.
   */
  async index({ auth, bouncer, inertia }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canRespondToRfq', org)

    const rfqs = await this.service.listForSupplier(org.id)

    return inertia.render('supplier/rfqs/index', {
      rfqs: rfqs.map((rfq) => new SupplierRfqTransformer(rfq).toObject()),
    })
  }

  /**
   * Détail d'une demande reçue. L'ouverture **vaut accusé de lecture** :
   * `markViewed` bascule `sent` → `viewed` avant le rendu, pour que l'acheteur
   * voie l'avancement sans que le fournisseur ait à cliquer quoi que ce soit.
   * La bascule n'est jamais régressive (une demande déjà déclinée ou honorée
   * reste dans son état).
   */
  async show({ auth, bouncer, inertia, params, i18n }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canRespondToRfq', org)

    const rfq = await this.service.openForSupplier(Number(params.id), org.id)

    const quote = await this.quotes.findLiveForRfq(rfq.id, org.id)
    const [recipient] = rfq.suppliers

    return inertia.render('supplier/rfqs/show', {
      rfq: new SupplierRfqDetailTransformer(rfq, i18n.locale as Locale).toObject(),
      // Le devis vivant du fournisseur, s'il en a un : l'écran y renvoie.
      quote: quote ? { id: quote.id, status: quote.status } : null,
      // Chiffrer suppose une demande encore ouverte et non déclinée.
      canQuote: this.service.acceptsResponses(rfq) && recipient?.status !== 'declined',
    })
  }

  /**
   * Le fournisseur décline la consultation. Un refus (demande déjà déclinée ou
   * chiffrée) devient un message flash, pas une page d'erreur.
   */
  async decline({ auth, bouncer, response, params, i18n, session }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canRespondToRfq', org)

    const rfq = await this.service.findForSupplier(Number(params.id), org.id)

    try {
      await this.service.decline(rfq, org.id)
      await emitter.emit(RfqDeclined, new RfqDeclined(rfq, org.id))
      session.flash('success', i18n.t('rfq.supplier.flash.declined'))
    } catch (error) {
      if (!(error instanceof RfqNotEditableException)) throw error
      session.flash('error', i18n.t('rfq.supplier.errors.notDecidable'))
    }

    return response.redirect().toRoute('supplier.rfqs.show', { locale: i18n.locale, id: rfq.id })
  }
}
