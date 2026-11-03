import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Quote from '#models/quote'
import QuoteItem from '#models/quote_item'
import Rfq from '#models/rfq'
import RfqSupplier from '#models/rfq_supplier'
import RfqService from '#services/rfq_service'
import QuoteAccepted from '#events/quote_accepted'
import QuoteRejected from '#events/quote_rejected'
import QuoteSubmitted from '#events/quote_submitted'
import {
  QuoteAlreadyExistsException,
  QuoteInvalidItemsException,
  QuoteInvalidValidityException,
  QuoteNotAllowedException,
  QuoteNotDecidableException,
  QuoteNotEditableException,
  QuoteNotFoundException,
  QuoteNotSubmittableException,
} from '#exceptions/quote_errors'
import { RFQ_DEADLINE_TIMEZONE } from '#shared/types/rfq'
import {
  BUYER_VISIBLE_QUOTE_STATUSES,
  DEFAULT_QUOTE_CURRENCY,
  LIVE_QUOTE_STATUSES,
} from '#shared/types/quote'
import type { QuoteData, QuoteItemData } from '#shared/types/quote'

/** Violation de contrainte d'unicité Postgres (`23505`). */
const UNIQUE_VIOLATION = '23505'

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
  constructor(private rfqs: RfqService) {}

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

    if (!this.rfqs.acceptsResponses(rfq) || !recipient || recipient.status === 'declined') {
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
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
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
    if (!this.rfqs.acceptsResponses(rfq)) throw new QuoteNotAllowedException()

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
   * passe `responded` (`RfqService#markResponded`). Refusé sans ligne, après la
   * validité, ou si la demande n'attend plus de réponse.
   */
  async submit(quote: Quote, now: DateTime = DateTime.now()): Promise<Quote> {
    if (quote.status !== 'draft') throw new QuoteNotSubmittableException()

    const rfq = await this.loadRfqForQuote(quote)
    if (!this.rfqs.acceptsResponses(rfq, now)) throw new QuoteNotAllowedException()

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
      await this.rfqs.markResponded(rfq, quote.supplierOrganizationId)
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
    if (!this.rfqs.acceptsResponses(rfq, now)) throw new QuoteNotDecidableException()

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
    if (!this.rfqs.acceptsResponses(rfq, now)) throw new QuoteNotDecidableException()

    const [updated] = await Quote.query()
      .where('id', quote.id)
      .where('status', 'submitted')
      .update({ status: 'rejected', decidedAt: now.toJSDate() })
    if (!Number(updated)) throw new QuoteNotDecidableException()

    await quote.refresh()
    await this.emitRejected(quote)
    return quote
  }

  // ── Expiration ──────────────────────────────────────────────────────────

  /**
   * Fait expirer les brouillons et devis remis des demandes qui viennent
   * d'expirer (`RfqService#expireDue`). Un devis déjà accepté ou rejeté garde
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
