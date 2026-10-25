import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { errors as vineErrors } from '@vinejs/vine'
import CategoryService from '#services/category_service'
import ProductCatalogueService from '#services/product_catalogue_service'
import OrganizationContextService from '#services/organization_context_service'
import QuoteService from '#services/quote_service'
import RfqNotificationService from '#services/rfq_notification_service'
import RfqService from '#services/rfq_service'
import CategoryTransformer from '#transformers/category_transformer'
import QuoteTransformer from '#transformers/quote_transformer'
import RfqDetailTransformer from '#transformers/rfq_detail_transformer'
import RfqProductOptionTransformer from '#transformers/rfq_product_option_transformer'
import RfqTransformer from '#transformers/rfq_transformer'
import {
  rfqDeadlineValidator,
  rfqLookupQueryValidator,
  rfqProductValidator,
  rfqSuppliersValidator,
  rfqValidator,
} from '#validators/rfq'
import { ProductNotFoundException } from '#exceptions/catalogue_errors'
import {
  NotASupplierOrganizationException,
  RfqInvalidDeadlineException,
  RfqNotExtendableException,
  RfqNotClosableException,
  RfqNotEditableException,
  RfqNotPublishableException,
  RfqNotSendableException,
} from '#exceptions/rfq_errors'
import type Organization from '#models/organization'
import type Rfq from '#models/rfq'
import type { Locale } from '#shared/types/i18n'

/**
 * Refus de transition → clé de traduction. Une exception absente de cette
 * table n'est pas un cas métier attendu : elle remonte telle quelle.
 */
const TRANSITION_ERRORS = [
  { type: RfqNotEditableException, key: 'rfq.errors.notEditable' },
  { type: RfqNotPublishableException, key: 'rfq.errors.notPublishable' },
  { type: RfqNotSendableException, key: 'rfq.errors.notSendable' },
  { type: RfqNotClosableException, key: 'rfq.errors.notClosable' },
  { type: NotASupplierOrganizationException, key: 'rfq.errors.notASupplier' },
  { type: RfqNotExtendableException, key: 'rfq.errors.notExtendable' },
  { type: RfqInvalidDeadlineException, key: 'rfq.errors.invalidDeadline' },
] as const

/** Longueur minimale de la saisie et nombre de résultats du sélecteur de produit. */
const PRODUCT_SEARCH_MIN_LENGTH = 2
const PRODUCT_SEARCH_LIMIT = 8

/** Contexte minimal pour charger et autoriser une demande. */
type RfqContext = Pick<HttpContext, 'auth' | 'bouncer' | 'params'>

/**
 * Demandes de devis, côté **acheteur**. Controller fin : organisation
 * courante + autorisation + validation → `RfqService`, qui porte seul les
 * transitions et leurs règles.
 *
 * Deux niveaux d'autorisation, alignés sur les permissions `sourcing:*` :
 * `canCreateRfq` pour consulter et rédiger (jusqu'au rôle `member`),
 * `canManageRfq` pour publier, envoyer et clôturer (owner/admin/manager).
 */
@inject()
export default class RfqsController {
  constructor(
    private service: RfqService,
    private notifications: RfqNotificationService,
    private quotes: QuoteService,
    private categories: CategoryService,
    private catalogue: ProductCatalogueService,
    private organizations: OrganizationContextService
  ) {}

  /**
   * Liste des demandes de l'organisation acheteuse, brouillons compris.
   */
  async index({ auth, bouncer, inertia }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canCreateRfq', org)

    const rfqs = await this.service.listForBuyer(org.id)

    return inertia.render('rfqs/index', {
      rfqs: rfqs.map((rfq) => new RfqTransformer(rfq).toObject()),
      canManageRfq: await bouncer.allows('canManageRfq', org),
    })
  }

  /**
   * Formulaire de création : besoin, lignes et destinataires en une passe.
   *
   * `?productId=` (bouton « Demander un devis » d'une fiche produit) pré-remplit
   * une ligne avec le produit et pré-coche son fournisseur. Un produit
   * introuvable ou plus visible n'est pas une erreur : le formulaire s'ouvre
   * vide, comme sans paramètre.
   */
  async create({ auth, bouncer, inertia, i18n, request }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canCreateRfq', org)

    const locale = i18n.locale as Locale
    const { productId, productSearch } = await this.lookupParams(request)

    return inertia.render('rfqs/create', {
      ...(await this.formData(locale)),
      productResults: this.productResults(inertia, productSearch, locale),
      prefillProduct: productId ? await this.findProduct(productId, locale) : undefined,
    })
  }

  /**
   * Crée le brouillon avec ses lignes, puis y attache les destinataires
   * sélectionnés. Rien n'est envoyé à ce stade : l'acheteur relit sa demande
   * sur l'écran de détail, d'où il publie puis envoie.
   */
  async store({ auth, bouncer, request, response, i18n, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const org = await this.organizations.currentFor(user)
    await bouncer.authorize('canCreateRfq', org)

    const payload = await request.validateUsing(rfqValidator)
    const rfq = await this.service.create(org, user, payload)

    if (payload.supplierOrganizationIds?.length) {
      try {
        await this.service.addSuppliers(rfq, payload.supplierOrganizationIds)
      } catch (error) {
        if (!(error instanceof NotASupplierOrganizationException)) throw error
        // La demande est créée : on ne la perd pas pour un destinataire devenu
        // inéligible entre l'affichage du formulaire et l'envoi.
        session.flash('error', i18n.t('rfq.errors.notASupplier'))
      }
    }

    session.flash('success', i18n.t('rfq.flash.created'))
    return response.redirect().toRoute('rfqs.show', { locale: i18n.locale, id: rfq.id })
  }

  /**
   * Détail : le besoin, l'avancement par destinataire, et les actions
   * disponibles selon le statut.
   */
  async show({ auth, bouncer, inertia, params, i18n, request }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canCreateRfq', org)

    const rfq = await this.service.findForBuyer(Number(params.id), org.id)
    const locale = i18n.locale as Locale

    const { productSearch } = await this.lookupParams(request)
    // Devis remis par les fournisseurs, du moins cher au plus cher.
    const quotes = await this.quotes.listForRfq(rfq.id)

    return inertia.render('rfqs/show', {
      rfq: new RfqDetailTransformer(rfq, locale).toObject(),
      quotes: quotes.map((quote) => new QuoteTransformer(quote).toObject()),
      canManageRfq: await bouncer.allows('canManageRfq', org),
      ...(await this.formData(locale)),
      productResults: this.productResults(inertia, productSearch, locale),
    })
  }

  /**
   * Met à jour l'en-tête et remplace les lignes d'un brouillon.
   */
  async update(ctx: HttpContext) {
    const { rfq } = await this.loadManageable(ctx)
    const payload = await ctx.request.validateUsing(rfqValidator)

    return this.runTransition(ctx, rfq, async () => {
      await this.service.update(rfq, payload)
      await this.service.replaceItems(rfq, payload.items)
      ctx.session.flash('success', ctx.i18n.t('rfq.flash.updated'))
    })
  }

  /**
   * Ajoute un produit du catalogue comme nouvelle ligne d'un brouillon, avec
   * son fournisseur comme destinataire. Atterrit sur le brouillon, où
   * l'acheteur ajuste la quantité avant de publier.
   */
  async addProduct(ctx: HttpContext) {
    const { rfq } = await this.loadManageable(ctx)
    const { productId } = await ctx.request.validateUsing(rfqProductValidator)
    const product = await this.findProduct(productId, ctx.i18n.locale as Locale)
    if (!product) throw new ProductNotFoundException()

    return this.runTransition(ctx, rfq, async () => {
      await this.service.addProductItem(rfq, product)
      ctx.session.flash('success', ctx.i18n.t('rfq.flash.productAdded', { name: product.name }))
    })
  }

  /**
   * Supprime un brouillon. Une demande publiée ne se supprime pas : elle se
   * clôture. Le refus devient un message flash sur la demande, comme pour les
   * autres transitions.
   */
  async destroy(ctx: HttpContext) {
    const { rfq } = await this.loadManageable(ctx)

    try {
      await this.service.delete(rfq)
    } catch (error) {
      if (!(error instanceof RfqNotEditableException)) throw error
      ctx.session.flash('error', ctx.i18n.t('rfq.errors.notDeletable'))
      return ctx.response.redirect().toRoute('rfqs.show', { locale: ctx.i18n.locale, id: rfq.id })
    }

    ctx.session.flash('success', ctx.i18n.t('rfq.flash.deleted'))
    return ctx.response.redirect().toRoute('rfqs.index', { locale: ctx.i18n.locale })
  }

  /**
   * Ajoute des destinataires (brouillon, ou élargissement d'une demande déjà
   * publiée).
   */
  async addSuppliers(ctx: HttpContext) {
    const { rfq } = await this.loadManageable(ctx)
    const { supplierOrganizationIds } = await ctx.request.validateUsing(rfqSuppliersValidator)

    return this.runTransition(ctx, rfq, async () => {
      const added = await this.service.addSuppliers(rfq, supplierOrganizationIds)
      ctx.session.flash('success', ctx.i18n.t('rfq.flash.suppliersAdded', { count: added.length }))
    })
  }

  /**
   * Retire un destinataire non encore notifié.
   */
  async removeSupplier(ctx: HttpContext) {
    const { rfq } = await this.loadManageable(ctx)

    return this.runTransition(ctx, rfq, async () => {
      await this.service.removeSupplier(rfq, Number(ctx.params.supplierId))
      ctx.session.flash('success', ctx.i18n.t('rfq.flash.supplierRemoved'))
    })
  }

  /**
   * Fige le besoin : la demande devient diffusable.
   */
  async publish(ctx: HttpContext) {
    const { rfq } = await this.loadManageable(ctx)

    return this.runTransition(ctx, rfq, async () => {
      await this.service.publish(rfq)
      ctx.session.flash('success', ctx.i18n.t('rfq.flash.published'))
    })
  }

  /**
   * Notifie les destinataires en attente : bascule leur statut, puis met en
   * queue un mail par destinataire. Seules les lignes réellement basculées
   * sont notifiées — un fournisseur déjà destinataire d'un envoi précédent
   * n'est pas relancé.
   */
  async send(ctx: HttpContext) {
    const { rfq, org } = await this.loadManageable(ctx)

    return this.runTransition(ctx, rfq, async () => {
      const sent = await this.service.send(rfq)
      await this.notifications.notifyRecipients(rfq, org, sent)
      ctx.session.flash('success', ctx.i18n.t('rfq.flash.sent', { count: sent.length }))
    })
  }

  /**
   * Prolonge l'échéance d'une demande publiée ou échue. Sur une demande échue,
   * la nouvelle date la rouvre. Ne touche à rien d'autre que `deadline`.
   */
  async extendDeadline(ctx: HttpContext) {
    const { rfq } = await this.loadManageable(ctx)
    const payload = await ctx.request.validateUsing(rfqDeadlineValidator)

    return this.runTransition(ctx, rfq, async () => {
      const wasExpired = rfq.status === 'expired'
      await this.service.extendDeadline(rfq, payload)
      ctx.session.flash(
        'success',
        ctx.i18n.t(wasExpired ? 'rfq.flash.reopened' : 'rfq.flash.deadlineExtended')
      )
    })
  }

  /**
   * Clôture : l'acheteur a assez de réponses.
   */
  async close(ctx: HttpContext) {
    const { rfq } = await this.loadManageable(ctx)

    return this.runTransition(ctx, rfq, async () => {
      await this.service.close(rfq)
      ctx.session.flash('success', ctx.i18n.t('rfq.flash.closed'))
    })
  }

  /**
   * Charge la demande de l'organisation courante (404 si elle appartient à une
   * autre) et vérifie le droit de la piloter. L'organisation est renvoyée avec
   * la demande : `send` en a besoin pour nommer l'acheteur dans le mail, sans
   * la résoudre une seconde fois.
   */
  private async loadManageable({
    auth,
    bouncer,
    params,
  }: RfqContext): Promise<{ rfq: Rfq; org: Organization }> {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canManageRfq', org)

    return { rfq: await this.service.findForBuyer(Number(params.id), org.id), org }
  }

  /**
   * Exécute une transition et retombe sur l'écran de détail. Un refus du
   * service devient un message flash — la page reste affichée avec
   * l'explication — plutôt qu'une page d'erreur.
   */
  private async runTransition(
    { i18n, session, response }: HttpContext,
    rfq: Rfq,
    action: () => Promise<void>
  ) {
    try {
      await action()
    } catch (error) {
      const known = TRANSITION_ERRORS.find(({ type }) => error instanceof type)
      if (!known) throw error
      session.flash('error', i18n.t(known.key))
    }

    return response.redirect().toRoute('rfqs.show', { locale: i18n.locale, id: rfq.id })
  }

  /**
   * Paramètres de requête `productId` / `productSearch`, validés. Une valeur
   * invalide (`?productId=12abc`, tableau…) est ignorée plutôt que refusée : ce
   * sont des aides à la saisie, pas des données — le formulaire s'ouvre vide.
   */
  private async lookupParams(
    request: HttpContext['request']
  ): Promise<{ productId?: number; productSearch?: string }> {
    try {
      return await rfqLookupQueryValidator.validate(request.qs())
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) return {}
      throw error
    }
  }

  /**
   * Produit du catalogue au format du formulaire, `undefined` s'il n'est pas
   * (ou plus) demandable.
   */
  private async findProduct(id: number, locale: Locale) {
    const product = await this.catalogue.findForRfq(id)
    return product ? new RfqProductOptionTransformer(product, locale).toObject() : undefined
  }

  /**
   * Résultats du sélecteur de produit. Prop **optionnelle** : n'est évaluée
   * que lorsqu'un partial reload la demande (`only: ['productResults']`), donc
   * jamais au simple affichage de la page.
   */
  private productResults(
    inertia: HttpContext['inertia'],
    search: string | undefined,
    locale: Locale
  ) {
    return inertia.optional(async () => {
      if (!search || search.length < PRODUCT_SEARCH_MIN_LENGTH) return []

      const products = await this.catalogue.lookupForRfq(search, locale, PRODUCT_SEARCH_LIMIT)
      return products.map((product) => new RfqProductOptionTransformer(product, locale).toObject())
    })
  }

  /**
   * Données communes aux formulaires : catégories (pour cadrer une ligne) et
   * organisations fournisseuses éligibles (destinataires).
   */
  private async formData(locale: Locale) {
    const [categories, suppliers] = await Promise.all([
      this.categories.listForAdmin(),
      this.service.eligibleSuppliers(),
    ])

    return {
      categories: categories.map((category) =>
        new CategoryTransformer(category, locale).toObject()
      ),
      supplierOptions: suppliers.map((organization) => ({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logoUrl: organization.logoUrl,
      })),
    }
  }
}
