import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Quote from '#models/quote'
import QuoteDocument from '#models/quote_document'
import QuoteItem from '#models/quote_item'
import Rfq from '#models/rfq'
import RfqSupplier from '#models/rfq_supplier'
import RfqService from '#services/rfq_service'
import RfqRecipientService from '#services/rfq_recipient_service'
import { acceptsResponses } from '#shared/helpers/rfq_deadline'
import QuoteAccepted from '#events/quote_accepted'
import QuoteRejected from '#events/quote_rejected'
import QuoteSubmitted from '#events/quote_submitted'
import {
  QuoteAlreadyExistsException,
  QuoteDocumentNotFoundException,
  QuoteInvalidItemsException,
  QuoteInvalidValidityException,
  QuoteNotAllowedException,
  QuoteNotDecidableException,
  QuoteNotEditableException,
  QuoteNotFoundException,
  QuoteNotSubmittableException,
} from '#exceptions/quote_errors'
import { isUniqueViolation } from '#shared/helpers/database'
import { RFQ_DEADLINE_TIMEZONE } from '#shared/types/rfq'
import {
  BUYER_VISIBLE_QUOTE_STATUSES,
  DEFAULT_QUOTE_CURRENCY,
  LIVE_QUOTE_STATUSES,
} from '#shared/types/quote'
import type { QuoteData, QuoteDocumentInput, QuoteItemData } from '#shared/types/quote'

/** Prix unitaires en 1/10 000 (`decimal(12, 4)`), totaux en centimes. */
const UNIT_PRICE_SCALE = 10_000

/** Ligne prête à être écrite, montants déjà calculés (chaînes `numeric`). */
interface PricedItem {
  rfqItemId: number
  productId: number | null
  unitPrice: string
  quantity: number
  totalPrice: string
  leadTimeDays: number
  customizationDetails: QuoteItemData['customizationDetails']
}

/**
 * Cycle de vie d'un devis fournisseur.
 *
 * ```
 * draft ──submit──▶ submitted ──accept──▶ accepted
 *   │                   │  └──reject──▶ rejected
 *   └───────────────────┴──expire────▶ expired
 * ```
 *
 * Les montants sont **toujours** calculés ici (prix unitaire × quantité, arrondi
 * au centime) : le client n'envoie que prix, quantités et délais. Chaque
 * transition est un `UPDATE … WHERE status = …` : la garde est en base, pas sur
 * l'instance chargée, donc deux requêtes concurrentes (accepter / rejeter,
 * remettre deux fois) ne s'écrasent jamais.
 *
 * Accepter un devis **clôture la demande** et rejette les autres devis remis,
 * dans une même transaction ; `QuoteAccepted` est le point d'entrée de la
 * création de commande (#6).
 */
@inject()
export default class QuoteService {
  constructor(
    private rfqs: RfqService,
    private recipients: RfqRecipientService
  ) {}

  // ── Fournisseur ─────────────────────────────────────────────────────────

  /**
   * Devis de l'organisation fournisseuse, le plus récemment modifié en tête.
   */
  listForSupplier(organizationId: number): Promise<Quote[]> {
    return Quote.query()
      .where('supplierOrganizationId', organizationId)
      .preload('rfq')
      .preload('supplierOrganization')
      .preload('items', (items) => items.preload('rfqItem'))
      .orderBy('updatedAt', 'desc')
  }

  /**
   * Devis d'un fournisseur, avec son détail. Un devis d'une autre organisation
   * est un 404, pas un 403.
   */
  async findForSupplier(id: number, organizationId: number): Promise<Quote> {
    const quote = await Quote.query()
      .where('id', id)
      .where('supplierOrganizationId', organizationId)
      .preload('rfq', (rfq) => rfq.preload('buyerOrganization'))
      .preload('supplierOrganization')
      .preload('items', (items) => items.preload('rfqItem').orderBy('id'))
      .first()

    if (!quote) throw new QuoteNotFoundException()
    return quote
  }

  /**
   * Le devis vivant d'un fournisseur sur une demande (brouillon, remis ou
   * accepté), s'il existe — l'écran de la demande y renvoie au lieu d'en
   * proposer un second.
   */
  findLiveForRfq(rfqId: number, organizationId: number): Promise<Quote | null> {
    return Quote.query()
      .where('rfqId', rfqId)
      .where('supplierOrganizationId', organizationId)
      .whereIn('status', [...LIVE_QUOTE_STATUSES])
      .first()
  }

  /**
   * Ouvre un brouillon de devis sur une demande **reçue** (le fournisseur est
   * destinataire, notifié, n'a pas décliné) et **encore ouverte**.
   */
  async createDraft(rfqId: number, organizationId: number, data: QuoteData): Promise<Quote> {
    const rfq = await this.rfqs.findForSupplier(rfqId, organizationId)
    const [recipient] = rfq.suppliers

    if (!acceptsResponses(rfq) || !recipient || recipient.status === 'declined') {
      throw new QuoteNotAllowedException()
    }
    if (await this.findLiveForRfq(rfq.id, organizationId)) throw new QuoteAlreadyExistsException()

    const validUntil = this.parseValidUntil(data.validUntil)
    const items = this.priceItems(rfq, data.items)

    try {
      return await db.transaction(async (trx) => {
        const quote = await Quote.create(
          {
            rfqId: rfq.id,
            supplierOrganizationId: organizationId,
            status: 'draft',
            currency: DEFAULT_QUOTE_CURRENCY,
            validUntil,
            notes: data.notes ?? null,
            totalAmount: this.sum(items),
          },
          { client: trx }
        )
        await this.writeItems(quote, items, trx)
        return quote
      })
    } catch (error) {
      // Deux créations simultanées : l'index unique partiel tranche.
      if (isUniqueViolation(error)) {
        throw new QuoteAlreadyExistsException()
      }
      throw error
    }
  }

  /**
   * Met à jour un brouillon (en-tête et lignes remplacées). Un devis remis est
   * figé : l'acheteur compare ce que le fournisseur a effectivement promis.
   */
  async updateDraft(quote: Quote, data: QuoteData): Promise<Quote> {
    const rfq = await this.loadRfqForQuote(quote)
    if (!acceptsResponses(rfq)) throw new QuoteNotAllowedException()

    const validUntil = this.parseValidUntil(data.validUntil)
    const items = this.priceItems(rfq, data.items)

    await db.transaction(async (trx) => {
      const [updated] = await Quote.query({ client: trx })
        .where('id', quote.id)
        .where('status', 'draft')
        .update({
          validUntil: validUntil?.toSQLDate() ?? null,
          notes: data.notes ?? null,
          totalAmount: this.sum(items),
          updatedAt: DateTime.now().toJSDate(),
        })
      if (!Number(updated)) throw new QuoteNotEditableException()

      await QuoteItem.query({ client: trx }).where('quoteId', quote.id).delete()
      await this.writeItems(quote, items, trx)
    })

    await quote.refresh()
    return quote
  }

  /**
   * Remet le devis à l'acheteur : `draft` → `submitted`, et le destinataire
   * passe `responded` (`RfqRecipientService#markResponded`). Refusé sans ligne, après la
   * validité, ou si la demande n'attend plus de réponse.
   */
  async submit(quote: Quote, now: DateTime = DateTime.now()): Promise<Quote> {
    if (quote.status !== 'draft') throw new QuoteNotSubmittableException()

    const rfq = await this.loadRfqForQuote(quote)
    if (!acceptsResponses(rfq, now)) throw new QuoteNotAllowedException()

    const [{ total }] = await db.from('quote_items').where('quote_id', quote.id).count('* as total')
    if (Number(total) === 0) throw new QuoteNotSubmittableException()
    if (quote.validUntil && quote.validUntil.toISODate()! < this.today(now).toISODate()!) {
      throw new QuoteNotSubmittableException()
    }

    const recipient = await RfqSupplier.query()
      .where('rfqId', rfq.id)
      .where('supplierOrganizationId', quote.supplierOrganizationId)
      .firstOrFail()
    if (recipient.status === 'declined') throw new QuoteNotAllowedException()
    // Un fournisseur déjà `responded` (devis précédent rejeté) y reste.
    if (recipient.status !== 'responded') {
      await this.recipients.markResponded(rfq, quote.supplierOrganizationId)
    }

    const [updated] = await Quote.query()
      .where('id', quote.id)
      .where('status', 'draft')
      .update({ status: 'submitted', submittedAt: now.toJSDate() })
    if (!Number(updated)) throw new QuoteNotSubmittableException()

    await quote.refresh()
    await this.publish(new QuoteSubmitted(quote))
    return quote
  }

  /**
   * Supprime un brouillon (un devis remis se rejette ou expire, il ne disparaît
   * pas). Les lignes partent en cascade.
   */
  async deleteDraft(quote: Quote): Promise<void> {
    const [deleted] = await Quote.query().where('id', quote.id).where('status', 'draft').delete()
    if (!Number(deleted)) throw new QuoteNotEditableException()
  }

  // ── Acheteur ────────────────────────────────────────────────────────────

  /**
   * Devis **remis** pour une demande, du moins cher au plus cher. Les
   * brouillons restent le secret du fournisseur.
   */
  listForRfq(rfqId: number): Promise<Quote[]> {
    return Quote.query()
      .where('rfqId', rfqId)
      .whereIn('status', [...BUYER_VISIBLE_QUOTE_STATUSES])
      .preload('rfq')
      .preload('supplierOrganization')
      .preload('items', (items) => items.preload('rfqItem').orderBy('rfqItemId'))
      .orderBy('totalAmount', 'asc')
  }

  /**
   * Devis d'une demande de l'organisation acheteuse. L'appartenance fait partie
   * du critère de recherche : le devis d'une autre organisation, ou un
   * brouillon, est un 404.
   */
  async findForBuyer(id: number, buyerOrganizationId: number): Promise<Quote> {
    const quote = await Quote.query()
      .where('id', id)
      .whereIn('status', [...BUYER_VISIBLE_QUOTE_STATUSES])
      .whereHas('rfq', (rfq) => rfq.where('buyerOrganizationId', buyerOrganizationId))
      .preload('rfq')
      .preload('supplierOrganization')
      .preload('items', (items) => items.preload('rfqItem').orderBy('rfqItemId'))
      .first()

    if (!quote) throw new QuoteNotFoundException()
    return quote
  }

  /**
   * Accepte un devis remis : il passe `accepted`, les autres devis remis de la
   * demande passent `rejected` et la demande est clôturée — le tout dans une
   * transaction, avec les mêmes gardes conditionnelles que les autres
   * transitions. Renvoie les devis rejetés d'office.
   */
  async accept(quote: Quote, now: DateTime = DateTime.now()): Promise<Quote[]> {
    const rfq = await this.loadRfqForQuote(quote)
    if (!acceptsResponses(rfq, now)) throw new QuoteNotDecidableException()

    const losers = await db.transaction(async (trx) => {
      const [accepted] = await Quote.query({ client: trx })
        .where('id', quote.id)
        .where('status', 'submitted')
        .update({ status: 'accepted', decidedAt: now.toJSDate() })
      if (!Number(accepted)) throw new QuoteNotDecidableException()

      // Clôture de la demande : la même transition que `RfqService#close`, mais
      // conditionnelle et dans la transaction.
      const [closed] = await Rfq.query({ client: trx })
        .where('id', rfq.id)
        .where('status', 'published')
        .update({ status: 'closed', closedAt: now.toJSDate() })
      if (!Number(closed)) throw new QuoteNotDecidableException()

      const others = await Quote.query({ client: trx })
        .where('rfqId', rfq.id)
        .where('status', 'submitted')
        .whereNot('id', quote.id)
        .select('id')
      const ids = others.map(({ id }) => id)
      if (ids.length > 0) {
        await Quote.query({ client: trx })
          .whereIn('id', ids)
          .update({ status: 'rejected', decidedAt: now.toJSDate() })
      }
      return ids
    })

    await quote.refresh()
    await this.publish(new QuoteAccepted(quote))

    const rejected = await Quote.query().whereIn('id', losers)
    for (const loser of rejected) await this.emitRejected(loser)
    return rejected
  }

  /**
   * Rejette un devis remis, sans clore la demande : l'acheteur attend d'autres
   * offres.
   */
  async reject(quote: Quote, now: DateTime = DateTime.now()): Promise<Quote> {
    const rfq = await this.loadRfqForQuote(quote)
    if (!acceptsResponses(rfq, now)) throw new QuoteNotDecidableException()

    const [updated] = await Quote.query()
      .where('id', quote.id)
      .where('status', 'submitted')
      .update({ status: 'rejected', decidedAt: now.toJSDate() })
    if (!Number(updated)) throw new QuoteNotDecidableException()

    await quote.refresh()
    await this.emitRejected(quote)
    return quote
  }

  // ── Devis reçus en PDF (#224) ───────────────────────────────────────────

  /**
   * Enregistre les PDF d'une réponse reçue par mail comme devis du
   * fournisseur, dans la transaction qui écrit le message. Ils s'ajoutent aux
   * précédents sans les remplacer, et coexistent avec le devis structuré.
   *
   * La version destinataire (#238), déjà stockée par l'appelant, est référencée
   * ici, dans la même transaction : si elle échoue, l'appelant la libère.
   */
  recordDocuments(
    documents: QuoteDocumentInput[],
    trx: TransactionClientContract
  ): Promise<QuoteDocument[]> {
    const now = DateTime.now()
    return QuoteDocument.createMany(
      documents.map((document) => ({
        ...document,
        receivedAt: DateTime.fromJSDate(document.receivedAt),
        stampedAt: document.recipientStorageObjectId ? now : null,
      })),
      { client: trx }
    )
  }

  /**
   * Tous les devis PDF d'un destinataire, du plus récent au plus ancien, avec
   * leur fichier et leur version destinataire (`QuoteDocument#recipientFile`).
   */
  documentsFor(rfqSupplierId: number): Promise<QuoteDocument[]> {
    return QuoteDocument.query()
      .where('rfqSupplierId', rfqSupplierId)
      .preload('attachment', (attachment) => attachment.preload('storageObject'))
      .preload('recipientStorageObject')
      .orderBy('receivedAt', 'desc')
      .orderBy('id', 'desc')
  }

  /**
   * Tous les devis PDF reçus pour une demande (#228), le plus récent en tête,
   * avec le nom de leur fichier : l'écran de la demande les liste à côté des
   * devis structurés. Colonnes explicites, pièce jointe préchargée en une
   * requête.
   *
   * Le destinataire de chaque devis est repris de `rfq.suppliers` (préchargés
   * avec leur organisation par `RfqService#findForBuyer`) plutôt que relu en
   * base : aucune requête de plus pour le nom du fournisseur.
   */
  async documentsForRfq(rfq: Rfq): Promise<QuoteDocument[]> {
    const recipients = new Map(rfq.suppliers.map((recipient) => [recipient.id, recipient]))
    const documents = await QuoteDocument.query()
      .select('id', 'rfqId', 'rfqSupplierId', 'messageAttachmentId', 'receivedAt', 'selectedAt')
      .where('rfqId', rfq.id)
      .whereIn('rfqSupplierId', [...recipients.keys()])
      .preload('attachment', (attachment) => attachment.select('id', 'filename', 'sizeBytes'))
      .orderBy('receivedAt', 'desc')
      .orderBy('id', 'desc')
    documents.forEach((document) =>
      document.$setRelated('rfqSupplier', recipients.get(document.rfqSupplierId)!)
    )
    return documents
  }

  /**
   * L'agence **retient** un devis PDF (#228) : il est marqué `selected_at` et
   * la demande est clôturée (`RfqService#close`), dans une même transaction.
   * La demande est relue sous verrou : deux décisions concurrentes (retenir
   * deux devis, accepter un devis structuré) ne clôturent qu'une fois, la
   * seconde est refusée (`RfqNotClosableException`).
   *
   * **Aucune commande** n'est créée et aucun événement n'est publié : la suite
   * (bon de commande, facturation) se fait entre l'agence et le fournisseur,
   * hors plateforme. Les devis structurés gardent leur statut.
   */
  async selectDocument(document: QuoteDocument, now: DateTime = DateTime.now()): Promise<void> {
    await db.transaction(async (trx) => {
      const rfq = await Rfq.query({ client: trx }).where('id', document.rfqId).forUpdate().first()
      if (!rfq) throw new QuoteDocumentNotFoundException()

      await this.rfqs.close(rfq, trx)
      await QuoteDocument.query({ client: trx })
        .where('id', document.id)
        .update({ selectedAt: now.toJSDate() })
    })
    await document.refresh()
  }

  /**
   * Les devis PDF `ids` du destinataire `rfqSupplierId`, dans l'ordre de leurs
   * identifiants (celui des pièces jointes du mail), avec leur pièce jointe :
   * de quoi les citer dans le mail transmis à l'agence (#225) sans charger
   * tout l'historique. Un identifiant d'un autre destinataire est ignoré.
   */
  documentsOfReply(rfqSupplierId: number, ids: number[]): Promise<QuoteDocument[]> {
    if (ids.length === 0) return Promise.resolve([])
    return QuoteDocument.query()
      .where('rfqSupplierId', rfqSupplierId)
      .whereIn('id', ids)
      .preload('attachment')
      .orderBy('id')
  }

  /**
   * Un devis PDF avec sa demande et ses fichiers, pour le servir à l'agence
   * (`QuoteDocumentsController`). Le droit d'accès est vérifié par l'ability
   * `canDownloadQuoteDocument`, sur la demande chargée ici.
   */
  async findDocument(id: number): Promise<QuoteDocument> {
    const document = await QuoteDocument.query()
      .where('id', id)
      .preload('rfq')
      .preload('attachment', (attachment) => attachment.preload('storageObject'))
      .preload('recipientStorageObject')
      .first()
    if (!document) throw new QuoteDocumentNotFoundException()
    return document
  }

  /**
   * Un devis PDF et sa demande, sans ses fichiers : ce qu'il faut pour le
   * retenir (`QuoteDocumentsController#select`) et vérifier l'ability
   * `canSelectQuoteDocument`. Inconnu : 404.
   */
  async findDocumentForDecision(id: number): Promise<QuoteDocument> {
    const document = await QuoteDocument.query()
      .select('id', 'rfqId', 'selectedAt')
      .where('id', id)
      .preload('rfq', (rfq) => rfq.select('id', 'buyerOrganizationId', 'status'))
      .first()
    if (!document) throw new QuoteDocumentNotFoundException()
    return document
  }

  /**
   * Les devis PDF **qui font foi** pour un destinataire : ceux de sa dernière
   * réponse (un mail peut en porter plusieurs). Vide s'il n'en a envoyé aucun.
   */
  async currentDocumentsFor(rfqSupplierId: number): Promise<QuoteDocument[]> {
    const documents = await this.documentsFor(rfqSupplierId)
    return documents.filter((document) => document.messageId === documents[0].messageId)
  }

  // ── Expiration ──────────────────────────────────────────────────────────

  /**
   * Fait expirer les brouillons et devis remis des demandes qui viennent
   * d'expirer (`RfqDeadlineService#expireDue`). Un devis déjà accepté ou rejeté garde
   * son statut. Renvoie le nombre de devis basculés.
   */
  async expireForRfqs(rfqIds: number[], client?: TransactionClientContract): Promise<number> {
    if (rfqIds.length === 0) return 0
    return this.expire(Quote.query({ client }).whereIn('rfqId', rfqIds))
  }

  /**
   * Fait expirer les devis dont la date de validité est passée (`valid_until`
   * antérieure à aujourd'hui, heure de Paris). Appelé par `ExpireRfqsJob`.
   */
  async expireOutdated(now: DateTime = DateTime.now()): Promise<number> {
    return this.expire(Quote.query().where('validUntil', '<', this.today(now).toSQLDate()!))
  }

  // ── Interne ─────────────────────────────────────────────────────────────

  private async expire(scope: ReturnType<typeof Quote.query>): Promise<number> {
    const [updated] = await scope
      .whereIn('status', ['draft', 'submitted'])
      .update({ status: 'expired' })
    const count = Number(updated)
    if (count > 0) logger.info({ count }, 'quotes expired')
    return count
  }

  private emitRejected(quote: Quote): Promise<void> {
    return this.publish(new QuoteRejected(quote))
  }

  /**
   * Publie un événement **après** la transition : un listener défaillant ne doit
   * pas faire échouer une requête dont l'état est déjà écrit.
   */
  private async publish(event: QuoteSubmitted | QuoteAccepted | QuoteRejected): Promise<void> {
    try {
      await emitter.emit(event.constructor as never, event as never)
    } catch (error) {
      logger.error({ err: error, quoteId: event.quote.id }, 'quote event listener failed')
    }
  }

  /** Demande d'un devis, avec ses items — la référence des lignes. */
  private async loadRfqForQuote(quote: Quote): Promise<Rfq> {
    return Rfq.query().where('id', quote.rfqId).preload('items').firstOrFail()
  }

  private async writeItems(
    quote: Quote,
    items: PricedItem[],
    trx: TransactionClientContract
  ): Promise<void> {
    await QuoteItem.createMany(
      items.map((item) => ({ ...item, quoteId: quote.id })),
      { client: trx }
    )
  }

  /**
   * Valide les lignes contre la demande (chaque `rfqItemId` appartient à la
   * demande, une seule fois) et calcule les montants. Le `productId` est repris
   * de l'item de la demande, pas du client.
   */
  private priceItems(rfq: Rfq, items: QuoteItemData[]): PricedItem[] {
    if (items.length === 0) throw new QuoteInvalidItemsException()

    const byId = new Map(rfq.items.map((item) => [item.id, item]))
    const seen = new Set<number>()

    return items.map((item) => {
      const target = byId.get(item.rfqItemId)
      if (!target || seen.has(item.rfqItemId)) throw new QuoteInvalidItemsException()
      seen.add(item.rfqItemId)

      const unit = Math.round(item.unitPrice * UNIT_PRICE_SCALE)
      const totalCents = Math.round((unit * item.quantity) / (UNIT_PRICE_SCALE / 100))

      return {
        rfqItemId: item.rfqItemId,
        productId: target.productId,
        unitPrice: (unit / UNIT_PRICE_SCALE).toFixed(4),
        quantity: item.quantity,
        totalPrice: (totalCents / 100).toFixed(2),
        leadTimeDays: item.leadTimeDays,
        customizationDetails: item.customizationDetails ?? null,
      }
    })
  }

  /** Somme des lignes, en centimes pour éviter la dérive des flottants. */
  private sum(items: PricedItem[]): string {
    const cents = items.reduce((acc, item) => acc + Math.round(Number(item.totalPrice) * 100), 0)
    return (cents / 100).toFixed(2)
  }

  private parseValidUntil(value: string | null | undefined): DateTime | null {
    if (!value) return null
    const parsed = DateTime.fromISO(value, { zone: RFQ_DEADLINE_TIMEZONE })
    if (!parsed.isValid || parsed < this.today(DateTime.now())) {
      throw new QuoteInvalidValidityException()
    }
    return parsed
  }

  /** Aujourd'hui, minuit heure de Paris. */
  private today(now: DateTime): DateTime {
    return now.setZone(RFQ_DEADLINE_TIMEZONE).startOf('day')
  }
}
