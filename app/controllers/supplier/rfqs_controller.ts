import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import RfqDeclined from '#events/rfq_declined'
import OrganizationContextService from '#services/organization_context_service'
import QuoteService from '#services/quote_service'
import RfqService from '#services/rfq_service'
import RfqRecipientService from '#services/rfq_recipient_service'
import RfqThreadService from '#services/rfq_thread_service'
import SubscriptionService from '#services/subscription_service'
import SupplierRfqDetailTransformer from '#transformers/supplier_rfq_detail_transformer'
import SupplierRfqTransformer from '#transformers/supplier_rfq_transformer'
import RfqThreadTransformer from '#transformers/rfq_thread_transformer'
import { RfqNotEditableException } from '#exceptions/rfq_errors'
import { acceptsResponses } from '#shared/helpers/rfq_deadline'
import type { Locale } from '#shared/types/i18n'
import type Organization from '#models/organization'
import type Rfq from '#models/rfq'
import type { RfqThreadType } from '#shared/types/conversation'
import type { SubscriptionUpsellType } from '#shared/types/subscription'

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
 *
 * Un fournisseur non abonné reçoit les demandes **sans l'agence** (#220) et un
 * encart qui l'invite à s'abonner (#222). La règle s'évalue à chaque lecture :
 * s'abonner révèle l'agence sur les demandes déjà reçues, l'expiration la
 * masque de nouveau.
 */
@inject()
export default class SupplierRfqsController {
  constructor(
    private service: RfqService,
    private recipients: RfqRecipientService,
    private quotes: QuoteService,
    private organizations: OrganizationContextService,
    private subscriptions: SubscriptionService,
    private threads: RfqThreadService
  ) {}

  /**
   * Liste des demandes reçues, la plus récemment publiée en tête.
   */
  async index({ auth, bouncer, inertia }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canRespondToRfq', org)

    const [rfqs, revealBuyer] = await Promise.all([
      this.service.listForSupplier(org.id),
      this.subscriptions.isSubscribed(org.id),
    ])

    return inertia.render('supplier/rfqs/index', {
      rfqs: rfqs.map((rfq) => new SupplierRfqTransformer(rfq, revealBuyer).toObject()),
      upsell: await this.upsellFor(revealBuyer, org, bouncer),
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

    const [quote, revealBuyer] = await Promise.all([
      this.quotes.findLiveForRfq(rfq.id, org.id),
      this.subscriptions.isSubscribed(org.id),
    ])
    const [recipient] = rfq.suppliers
    const thread = await this.threadFor(
      rfq,
      revealBuyer ? rfq.buyerOrganization.name : null,
      bouncer
    )

    return inertia.render('supplier/rfqs/show', {
      rfq: new SupplierRfqDetailTransformer(rfq, revealBuyer, i18n.locale as Locale).toObject(),
      upsell: await this.upsellFor(revealBuyer, org, bouncer),
      // Le devis vivant du fournisseur, s'il en a un : l'écran y renvoie.
      quote: quote ? { id: quote.id, status: quote.status } : null,
      // Chiffrer suppose une demande encore ouverte et non déclinée.
      canQuote: acceptsResponses(rfq) && recipient?.status !== 'declined',
      // Fil d'échanges avec l'agence (#226), nommée pour un abonné seulement.
      thread,
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
      await this.recipients.decline(rfq, org.id)
      await emitter.emit(RfqDeclined, new RfqDeclined(rfq, org.id))
      session.flash('success', i18n.t('rfq.supplier.flash.declined'))
    } catch (error) {
      if (!(error instanceof RfqNotEditableException)) throw error
      session.flash('error', i18n.t('rfq.supplier.errors.notDecidable'))
    }

    return response.redirect().toRoute('supplier.rfqs.show', { locale: i18n.locale, id: rfq.id })
  }

  /**
   * Fil d'échanges du fournisseur avec l'agence (#226). Orchestration de
   * l'écran (lecture du fil, autorisation) : reste dans le controller.
   */
  private async threadFor(
    rfq: Rfq,
    agencyName: string | null,
    bouncer: HttpContext['bouncer']
  ): Promise<RfqThreadType> {
    const [recipient] = rfq.suppliers
    const loaded = await this.threads.threadsFor([recipient.id])
    return new RfqThreadTransformer(recipient, {
      thread: loaded.get(recipient.id) ?? null,
      viewerSide: 'supplier',
      counterpartName: agencyName,
      canWrite: await bouncer.allows('canMessageRfqBuyer', rfq, recipient),
      closed: this.threads.isClosed(rfq),
    }).toObject()
  }

  /** Encart d'abonnement (#222), pour un fournisseur non abonné seulement. */
  private async upsellFor(
    subscribed: boolean,
    org: Organization,
    bouncer: HttpContext['bouncer']
  ): Promise<SubscriptionUpsellType | null> {
    if (subscribed) return null
    return { canSubscribe: await bouncer.allows('canManageSubscription', org) }
  }
}
