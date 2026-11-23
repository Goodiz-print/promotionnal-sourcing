import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import type { HasManyQueryBuilderContract } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'
import Organization from '#models/organization'
import Product from '#models/product'
import Rfq from '#models/rfq'
import RfqItem from '#models/rfq_item'
import RfqSupplier from '#models/rfq_supplier'
import User from '#models/user'
import RfqRecipientService from '#services/rfq_recipient_service'
import {
  NotASupplierOrganizationException,
  RfqNotClosableException,
  RfqNotEditableException,
  RfqNotFoundException,
  RfqNotPublishableException,
  RfqNotSendableException,
  RfqSupplierNotFoundException,
} from '#exceptions/rfq_errors'
import { DEFAULT_RFQ_ITEM_QUANTITY } from '#shared/types/rfq'
import { BUYER_VISIBLE_QUOTE_STATUSES } from '#shared/types/quote'
import { parseRfqDeadline } from '#shared/helpers/rfq_deadline'
import type {
  NewRfqData,
  RfqBuyerFilters,
  RfqItemData,
  RfqProductOptionType,
  RfqProgress,
  UpdateRfqData,
} from '#shared/types/rfq'

/** Colonnes d'une ligne de « Mes demandes » (`RfqListItemTransformer`). */
const RFQ_LIST_COLUMNS = [
  'id',
  'batchId',
  'buyerOrganizationId',
  'createdByUserId',
  'title',
  'status',
  'deadline',
  'budgetMax',
  'publishedAt',
  'closedAt',
  'expiredAt',
  'createdAt',
]

/**
 * Rédaction, lecture et diffusion d'une demande de devis (RFQ).
 *
 * ```
 * draft ──publish──▶ published ──close──▶ closed
 *                        │
 *                        └──send──▶ destinataires `pending` → `sent`
 * ```
 *
 * Deux services voisins portent le reste du cycle :
 * - `RfqDeadlineService` : expiration à l'échéance (`published` → `expired`)
 *   et prolongation, qui rouvre une demande échue ;
 * - `RfqRecipientService` : avancement de chaque destinataire (lu, répondu,
 *   décliné, expiré) et relance de ceux qui n'ont pas répondu.
 *
 * `publish` et `send` sont deux transitions distinctes : publier fige le
 * besoin, envoyer notifie les destinataires. Un acheteur peut donc ajouter un
 * fournisseur à une demande déjà publiée et relancer `send` sans renvoyer la
 * demande à ceux qui l'ont déjà reçue.
 *
 * Seul un brouillon est modifiable (titre, items, retrait d'un destinataire
 * non encore notifié) : une fois la demande partie chez un fournisseur, la
 * réécrire silencieusement fausserait les devis reçus. **Une seule exception** :
 * l'échéance se prolonge (`RfqDeadlineService#extendDeadline`) tant que la
 * demande est publiée ou échue — elle ne change pas le besoin, seulement le
 * temps laissé pour y répondre.
 */
@inject()
export default class RfqService {
  constructor(private recipients: RfqRecipientService) {}

  /**
   * « Mes demandes » (#228) : les demandes de l'organisation acheteuse,
   * brouillons compris, la plus récente en tête, filtrées par avancement
   * (`RfqProgress`) et par auteur. Une demande appartient à l'agence : tous ses
   * membres voient toutes ses demandes.
   *
   * Colonnes explicites ; items et destinataires sont préchargés pour leurs
   * compteurs (une requête par relation, pas de N+1), les devis remis et les
   * devis PDF seulement comptés en sous-requête (`$extras.receivedQuotesCount`,
   * `$extras.quoteDocumentsCount`).
   */
  listForBuyer(organizationId: number, filters: RfqBuyerFilters = {}): Promise<Rfq[]> {
    const query = Rfq.query()
      .select(RFQ_LIST_COLUMNS)
      .where('buyerOrganizationId', organizationId)
      .preload('items', (items) => items.select('id', 'rfqId'))
      .preload('suppliers', (suppliers) => suppliers.select('id', 'rfqId', 'status'))
      .preload('createdBy', (author) => author.select('id', 'firstName', 'lastName'))
      .withCount('quotes', (quotes) =>
        quotes.whereIn('status', [...BUYER_VISIBLE_QUOTE_STATUSES]).as('receivedQuotesCount')
      )
      .withCount('quoteDocuments', (documents) => documents.as('quoteDocumentsCount'))
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')

    if (filters.authorId) query.where('createdByUserId', filters.authorId)
    if (filters.status) this.whereProgress(query, filters.status)
    return query
  }

  /**
   * Auteurs des demandes de l'organisation, pour le filtre « auteur » de
   * « Mes demandes » : seuls ceux qui ont écrit au moins une demande.
   */
  authorsForBuyer(organizationId: number): Promise<User[]> {
    return User.query()
      .select('id', 'firstName', 'lastName', 'email')
      .whereIn(
        'id',
        db.from('rfqs').select('created_by_user_id').where('buyer_organization_id', organizationId)
      )
      .orderBy('firstName')
      .orderBy('lastName')
      .orderBy('id')
  }

  /**
   * Demande d'un acheteur, avec tout le détail de l'écran. L'appartenance à
   * l'organisation fait partie du critère de recherche : une demande d'une
   * autre organisation est un 404, pas un 403.
   */
  async findForBuyer(id: number, organizationId: number): Promise<Rfq> {
    const rfq = await Rfq.query()
      .where('id', id)
      .where('buyerOrganizationId', organizationId)
      .preload('items', (items) => this.preloadItemLabels(items))
      .preload('suppliers', (suppliers) => suppliers.preload('supplierOrganization'))
      .preload('createdBy')
      .first()

    if (!rfq) throw new RfqNotFoundException()
    return rfq
  }

  /**
   * Demandes reçues par une organisation fournisseur. Les destinataires encore
   * `pending` sont exclus : tant que l'acheteur n'a pas envoyé la demande,
   * elle n'existe pas pour le fournisseur.
   */
  listForSupplier(organizationId: number): Promise<Rfq[]> {
    return Rfq.query()
      .whereHas('suppliers', (suppliers) =>
        suppliers.where('supplierOrganizationId', organizationId).whereNot('status', 'pending')
      )
      .preload('buyerOrganization')
      .preload('items')
      .preload('suppliers', (suppliers) =>
        suppliers.where('supplierOrganizationId', organizationId)
      )
      .orderBy('publishedAt', 'desc')
  }

  async findForSupplier(id: number, organizationId: number): Promise<Rfq> {
    const rfq = await Rfq.query()
      .where('id', id)
      .whereHas('suppliers', (suppliers) =>
        suppliers.where('supplierOrganizationId', organizationId).whereNot('status', 'pending')
      )
      .preload('buyerOrganization')
      // Auteur de la demande, pour les coordonnées montrées à un abonné (#221).
      .preload('createdBy', (author) => author.select('id', 'firstName', 'lastName', 'email'))
      .preload('items', (items) => this.preloadItemLabels(items))
      .preload('suppliers', (suppliers) =>
        suppliers.where('supplierOrganizationId', organizationId)
      )
      .first()

    if (!rfq) throw new RfqNotFoundException()
    return rfq
  }

  /**
   * Ouverture d'une demande par un fournisseur : chargement **et** accusé de
   * lecture en une passe. La ligne destinataire préchargée est remplacée par
   * celle que renvoie `RfqRecipientService#applyViewed` — sans quoi l'écran afficherait encore
   * `sent` juste après avoir accusé réception.
   */
  async openForSupplier(id: number, organizationId: number): Promise<Rfq> {
    const rfq = await this.findForSupplier(id, organizationId)
    const [recipient] = rfq.suppliers
    if (recipient) await this.recipients.applyViewed(recipient)
    return rfq
  }

  /**
   * Crée un brouillon, avec ses items s'ils sont fournis. Transaction : une
   * demande sans ses lignes n'a pas de sens métier.
   */
  async create(
    organization: Organization,
    user: User,
    data: NewRfqData,
    client?: TransactionClientContract
  ): Promise<Rfq> {
    const requestable = await this.withRequestableProducts(data.items ?? [])

    // Transaction de l'appelant si fournie (validation du panier : plusieurs
    // demandes en tout ou rien), sinon la sienne.
    const write = async (trx: TransactionClientContract) => {
      const rfq = await Rfq.create(
        {
          buyerOrganizationId: organization.id,
          createdByUserId: user.id,
          status: 'draft',
          title: data.title,
          description: data.description ?? null,
          deadline: parseRfqDeadline(data.deadline),
          budgetMax: this.parseBudget(data.budgetMax),
          batchId: data.batchId ?? null,
          // Explicites : sans elles, l'instance renvoyée porte `undefined`
          // plutôt que `null` sur ces colonnes (jamais lues depuis la base
          // après un insert) — les transformers exposeraient un trou.
          publishedAt: null,
          closedAt: null,
        },
        { client: trx }
      )

      if (requestable.length) {
        await RfqItem.createMany(
          requestable.map((item) => this.itemAttributes(rfq.id, item)),
          { client: trx }
        )
      }

      await rfq.load('items', (items) => items.useTransaction(trx))
      return rfq
    }

    return client ? write(client) : db.transaction(write)
  }

  /**
   * Met à jour l'en-tête d'un brouillon (titre, description, échéance, budget).
   */
  async update(rfq: Rfq, data: UpdateRfqData): Promise<Rfq> {
    this.assertDraft(rfq)

    rfq.merge({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.deadline !== undefined ? { deadline: parseRfqDeadline(data.deadline) } : {}),
      ...(data.budgetMax !== undefined ? { budgetMax: this.parseBudget(data.budgetMax) } : {}),
    })
    await rfq.save()
    return rfq
  }

  /**
   * Remplace l'intégralité des items d'un brouillon. Remplacement plutôt que
   * diff : l'écran de création édite la liste comme un tout, et rien ne
   * référence encore un item (les devis de la Phase 4 arriveront après la
   * publication, quand la liste est figée).
   */
  async replaceItems(rfq: Rfq, items: RfqItemData[]): Promise<RfqItem[]> {
    this.assertDraft(rfq)
    const requestable = await this.withRequestableProducts(items)

    return db.transaction(async (trx) => {
      await RfqItem.query({ client: trx }).where('rfqId', rfq.id).delete()

      if (requestable.length === 0) return []

      return RfqItem.createMany(
        requestable.map((item) => this.itemAttributes(rfq.id, item)),
        { client: trx }
      )
    })
  }

  /**
   * Ajoute une ligne « produit du catalogue » à un brouillon, et son
   * fournisseur aux destinataires (déjà destinataire : ignoré). C'est le geste
   * « ajouter à une demande existante » de la fiche produit ; la ligne est
   * ajoutée **à la suite**, jamais en remplacement (`replaceItems`).
   *
   * Un produit déjà présent dans la demande reçoit une seconde ligne plutôt
   * qu'un refus : l'acheteur peut vouloir deux quantités ou deux marquages.
   *
   * Tout ou rien : l'éligibilité du fournisseur est vérifiée **avant** toute
   * écriture, puis la ligne et le destinataire sont écrits dans une même
   * transaction. Le statut est relu sous verrou (`FOR UPDATE`) : une demande
   * publiée dans un autre onglet entre-temps ne reçoit pas de ligne.
   */
  async addProductItem(rfq: Rfq, product: RfqProductOptionType): Promise<RfqItem> {
    this.assertDraft(rfq)

    const supplierId = product.supplierOrganizationId
    if (supplierId !== null) await this.assertSupplierOrganizations([supplierId])

    return db.transaction(async (trx) => {
      const current = await Rfq.query({ client: trx }).where('id', rfq.id).forUpdate().first()
      if (!current) throw new RfqNotFoundException()
      this.assertDraft(current)

      const item = await RfqItem.create(
        this.itemAttributes(rfq.id, {
          name: product.name,
          quantity: product.minQuantity ?? DEFAULT_RFQ_ITEM_QUANTITY,
          categoryId: product.categoryId,
          productId: product.id,
        }),
        { client: trx }
      )

      if (supplierId !== null) await this.addSuppliers(current, [supplierId], trx)
      return item
    })
  }

  /**
   * Supprime un brouillon (lignes et destinataires partent avec lui, FK
   * `CASCADE`). Une demande publiée n'est jamais supprimée : des fournisseurs
   * l'ont peut-être reçue, elle se clôture.
   */
  async delete(rfq: Rfq): Promise<void> {
    this.assertDraft(rfq)
    await rfq.delete()
  }

  /**
   * Ajoute des destinataires. Autorisé tant que la demande n'est ni close ni échue :
   * élargir la consultation d'une demande publiée est un cas nominal (les
   * nouveaux arrivent en `pending`, le prochain `send` les notifie).
   *
   * Les organisations déjà destinataires sont ignorées silencieusement — la
   * contrainte d'unicité `(rfq_id, supplier_organization_id)` garantit
   * qu'aucune demande n'est reçue deux fois.
   */
  async addSuppliers(
    rfq: Rfq,
    organizationIds: number[],
    client?: TransactionClientContract
  ): Promise<RfqSupplier[]> {
    if (rfq.status === 'closed' || rfq.status === 'expired') throw new RfqNotEditableException()

    const unique = [...new Set(organizationIds)]
    if (unique.length === 0) return []

    await this.assertSupplierOrganizations(unique)

    const existing = await RfqSupplier.query({ client })
      .where('rfqId', rfq.id)
      .whereIn('supplierOrganizationId', unique)
    const alreadyTargeted = new Set(existing.map((row) => row.supplierOrganizationId))

    const toCreate = unique.filter((id) => !alreadyTargeted.has(id))
    if (toCreate.length === 0) return []

    return RfqSupplier.createMany(
      toCreate.map((supplierOrganizationId) => ({
        rfqId: rfq.id,
        supplierOrganizationId,
        status: 'pending' as const,
      })),
      { client }
    )
  }

  /**
   * Retire un destinataire — uniquement s'il n'a pas encore été notifié.
   * Retirer un fournisseur qui a déjà reçu la demande effacerait la trace de
   * l'envoi ; l'acheteur clôture la demande à la place.
   */
  async removeSupplier(rfq: Rfq, rfqSupplierId: number): Promise<void> {
    const target = await RfqSupplier.query()
      .where('id', rfqSupplierId)
      .where('rfqId', rfq.id)
      .first()

    if (!target) throw new RfqSupplierNotFoundException()
    if (target.status !== 'pending') throw new RfqNotEditableException()

    await target.delete()
  }

  /**
   * Fige le besoin : `draft` → `published`. Une demande sans item n'est pas
   * chiffrable, elle est donc refusée.
   */
  async publish(rfq: Rfq, client?: TransactionClientContract): Promise<Rfq> {
    if (rfq.status !== 'draft') throw new RfqNotPublishableException()

    const [{ total }] = await (client ?? db)
      .from('rfq_items')
      .where('rfq_id', rfq.id)
      .count('* as total')
      .exec()

    if (Number(total) === 0) throw new RfqNotPublishableException()

    rfq.merge({ status: 'published', publishedAt: DateTime.now() })
    if (client) rfq.useTransaction(client)
    await rfq.save()
    return rfq
  }

  /**
   * Notifie les destinataires en attente : `pending` → `sent`. Renvoie les
   * lignes effectivement basculées — c'est cette liste que l'appelant utilise
   * pour dispatcher les mails, sans risquer de relancer un fournisseur déjà
   * notifié.
   */
  async send(rfq: Rfq, client?: TransactionClientContract): Promise<RfqSupplier[]> {
    if (rfq.status !== 'published') throw new RfqNotSendableException()

    const pending = await RfqSupplier.query({ client })
      .where('rfqId', rfq.id)
      .where('status', 'pending')
      .preload('supplierOrganization')

    if (pending.length === 0) throw new RfqNotSendableException()

    const sentAt = DateTime.now()
    for (const target of pending) {
      target.merge({ status: 'sent', sentAt })
      await target.save()
    }

    return pending
  }

  /**
   * Clôture : l'acheteur a assez de réponses. Les devis déjà reçus restent
   * consultables, aucun nouvel envoi n'est possible. Transaction de l'appelant
   * si fournie (devis PDF retenu, `QuoteService#selectDocument`).
   */
  async close(rfq: Rfq, client?: TransactionClientContract): Promise<Rfq> {
    if (rfq.status !== 'published') throw new RfqNotClosableException()

    rfq.merge({ status: 'closed', closedAt: DateTime.now() })
    if (client) rfq.useTransaction(client)
    await rfq.save()
    return rfq
  }

  /**
   * Organisations éligibles comme destinataires : fournisseuses et actives.
   * Alimente le sélecteur de l'écran de création — la même règle que celle
   * appliquée par `addSuppliers`, pour ne pas proposer un choix qui sera
   * refusé à l'enregistrement.
   */
  eligibleSuppliers(): Promise<Organization[]> {
    return Organization.query()
      .whereIn('organizationType', ['supplier', 'both'])
      .whereNull('archivedAt')
      .orderBy('name')
  }

  /**
   * Filtre SQL d'un avancement, miroir de `rfqProgress` : une demande publiée
   * est « envoyée » dès qu'un destinataire est notifié, « répondue » dès qu'un
   * destinataire a répondu.
   */
  private whereProgress(query: ModelQueryBuilderContract<typeof Rfq>, progress: RfqProgress) {
    const responded = (suppliers: ModelQueryBuilderContract<typeof RfqSupplier>) =>
      suppliers.where('status', 'responded')
    const notified = (suppliers: ModelQueryBuilderContract<typeof RfqSupplier>) =>
      suppliers.whereNot('status', 'pending')
    const published = () => query.where('status', 'published')
    const filters: Record<RfqProgress, () => void> = {
      draft: () => query.where('status', 'draft'),
      published: () => published().whereDoesntHave('suppliers', notified),
      sent: () =>
        published().whereHas('suppliers', notified).whereDoesntHave('suppliers', responded),
      responded: () => published().whereHas('suppliers', responded),
      expired: () => query.where('status', 'expired'),
      closed: () => query.where('status', 'closed'),
    }
    filters[progress]()
  }

  /**
   * Une demande ne part qu'à des organisations fournisseuses et actives : une
   * organisation acheteuse n'a pas d'écran pour y répondre, une organisation
   * archivée n'a plus personne pour la lire.
   */
  private async assertSupplierOrganizations(organizationIds: number[]): Promise<void> {
    const eligible = await Organization.query()
      .select('id')
      .whereIn('id', organizationIds)
      .whereIn('organizationType', ['supplier', 'both'])
      .whereNull('archivedAt')

    if (eligible.length !== organizationIds.length) throw new NotASupplierOrganizationException()
  }

  /**
   * Les items affichent le nom de la catégorie ou du produit référencé : leurs
   * traductions doivent suivre, la résolution étant faite par le transformer.
   */
  private preloadItemLabels(items: HasManyQueryBuilderContract<typeof RfqItem, RfqItem>): void {
    items
      .preload('category', (category) => category.preload('translations'))
      .preload('product', (product) => product.preload('translations'))
  }

  /**
   * Un `productId` envoyé par le formulaire n'est pas cru sur parole : un
   * identifiant inexistant, inactif, rejeté ou d'une organisation archivée perd
   * son lien avec le catalogue (`productId` → `null`). La ligne survit par son
   * `name`, comme quand un produit est supprimé (FK `SET NULL`), et un brouillon
   * dont un produit a été retiré du catalogue reste enregistrable.
   */
  private async withRequestableProducts(items: RfqItemData[]): Promise<RfqItemData[]> {
    const ids = [...new Set(items.flatMap((item) => (item.productId ? [item.productId] : [])))]
    if (ids.length === 0) return items

    const visible = await Product.query()
      .select('id')
      .whereIn('id', ids)
      .where('isActive', true)
      .withScopes((scopes) => {
        scopes.fromLiveOrganization()
        scopes.notRejected()
      })
    const allowed = new Set(visible.map((product) => product.id))

    return items.map((item) =>
      item.productId && !allowed.has(item.productId) ? { ...item, productId: null } : item
    )
  }

  private assertDraft(rfq: Rfq): void {
    if (rfq.status !== 'draft') throw new RfqNotEditableException()
  }

  private itemAttributes(rfqId: number, item: RfqItemData) {
    return {
      rfqId,
      name: item.name,
      description: item.description ?? null,
      quantity: item.quantity,
      unit: item.unit ?? null,
      categoryId: item.categoryId ?? null,
      productId: item.productId ?? null,
      specs: item.specs ?? null,
    }
  }

  /**
   * `budget_max` est une colonne `decimal` : Lucid la lit et l'écrit en
   * chaîne (cf. `products.price_min`), la saisie reste un nombre.
   */
  private parseBudget(budgetMax: number | null | undefined): string | null {
    return typeof budgetMax === 'number' ? String(budgetMax) : null
  }
}
