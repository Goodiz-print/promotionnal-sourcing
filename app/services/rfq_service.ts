import { DateTime } from 'luxon'
import type { HasManyQueryBuilderContract } from '@adonisjs/lucid/types/relations'
import db from '@adonisjs/lucid/services/db'
import Organization from '#models/organization'
import Rfq from '#models/rfq'
import RfqItem from '#models/rfq_item'
import RfqSupplier from '#models/rfq_supplier'
import type User from '#models/user'
import {
  NotASupplierOrganizationException,
  RfqNotClosableException,
  RfqNotEditableException,
  RfqNotFoundException,
  RfqNotPublishableException,
  RfqNotSendableException,
  RfqSupplierNotFoundException,
} from '#exceptions/rfq_errors'
import { TERMINAL_RFQ_SUPPLIER_STATUSES } from '#shared/types/rfq'
import type { CreateRfqData, RfqItemData, UpdateRfqData } from '#shared/types/rfq'

/**
 * Cycle de vie d'une demande de devis (RFQ).
 *
 * ```
 * draft ──publish──▶ published ──close──▶ closed
 *                        │
 *                        └──send──▶ destinataires `pending` → `sent`
 * ```
 *
 * `publish` et `send` sont deux transitions distinctes : publier fige le
 * besoin, envoyer notifie les destinataires. Un acheteur peut donc ajouter un
 * fournisseur à une demande déjà publiée et relancer `send` sans renvoyer la
 * demande à ceux qui l'ont déjà reçue.
 *
 * Seul un brouillon est modifiable (titre, items, retrait d'un destinataire
 * non encore notifié) : une fois la demande partie chez un fournisseur, la
 * réécrire silencieusement fausserait les devis reçus.
 */
export default class RfqService {
  /**
   * Demandes émises par l'organisation acheteuse, brouillons compris.
   */
  listForBuyer(organizationId: number): Promise<Rfq[]> {
    return Rfq.query()
      .where('buyerOrganizationId', organizationId)
      .preload('items')
      .preload('suppliers')
      .orderBy('createdAt', 'desc')
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
   * celle que renvoie `markViewed` — sans quoi l'écran afficherait encore
   * `sent` juste après avoir accusé réception.
   */
  async openForSupplier(id: number, organizationId: number): Promise<Rfq> {
    const rfq = await this.findForSupplier(id, organizationId)
    const [recipient] = rfq.suppliers
    if (recipient) await this.applyViewed(recipient)
    return rfq
  }

  /**
   * Crée un brouillon, avec ses items s'ils sont fournis. Transaction : une
   * demande sans ses lignes n'a pas de sens métier.
   */
  create(organization: Organization, user: User, data: CreateRfqData): Promise<Rfq> {
    return db.transaction(async (trx) => {
      const rfq = await Rfq.create(
        {
          buyerOrganizationId: organization.id,
          createdByUserId: user.id,
          status: 'draft',
          title: data.title,
          description: data.description ?? null,
          deadline: this.parseDeadline(data.deadline),
          budgetMax: this.parseBudget(data.budgetMax),
          // Explicites : sans elles, l'instance renvoyée porte `undefined`
          // plutôt que `null` sur ces colonnes (jamais lues depuis la base
          // après un insert) — les transformers exposeraient un trou.
          publishedAt: null,
          closedAt: null,
        },
        { client: trx }
      )

      if (data.items?.length) {
        await RfqItem.createMany(
          data.items.map((item) => this.itemAttributes(rfq.id, item)),
          { client: trx }
        )
      }

      await rfq.load('items', (items) => items.useTransaction(trx))
      return rfq
    })
  }

  /**
   * Met à jour l'en-tête d'un brouillon (titre, description, échéance, budget).
   */
  async update(rfq: Rfq, data: UpdateRfqData): Promise<Rfq> {
    this.assertDraft(rfq)

    rfq.merge({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.deadline !== undefined ? { deadline: this.parseDeadline(data.deadline) } : {}),
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

    return db.transaction(async (trx) => {
      await RfqItem.query({ client: trx }).where('rfqId', rfq.id).delete()

      if (items.length === 0) return []

      return RfqItem.createMany(
        items.map((item) => this.itemAttributes(rfq.id, item)),
        { client: trx }
      )
    })
  }

  /**
   * Ajoute des destinataires. Autorisé tant que la demande n'est pas close :
   * élargir la consultation d'une demande publiée est un cas nominal (les
   * nouveaux arrivent en `pending`, le prochain `send` les notifie).
   *
   * Les organisations déjà destinataires sont ignorées silencieusement — la
   * contrainte d'unicité `(rfq_id, supplier_organization_id)` garantit
   * qu'aucune demande n'est reçue deux fois.
   */
  async addSuppliers(rfq: Rfq, organizationIds: number[]): Promise<RfqSupplier[]> {
    if (rfq.status === 'closed') throw new RfqNotEditableException()

    const unique = [...new Set(organizationIds)]
    if (unique.length === 0) return []

    await this.assertSupplierOrganizations(unique)

    const existing = await RfqSupplier.query()
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
      }))
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
  async publish(rfq: Rfq): Promise<Rfq> {
    if (rfq.status !== 'draft') throw new RfqNotPublishableException()

    const [{ total }] = await db
      .from('rfq_items')
      .where('rfq_id', rfq.id)
      .count('* as total')
      .exec()

    if (Number(total) === 0) throw new RfqNotPublishableException()

    rfq.merge({ status: 'published', publishedAt: DateTime.now() })
    await rfq.save()
    return rfq
  }

  /**
   * Notifie les destinataires en attente : `pending` → `sent`. Renvoie les
   * lignes effectivement basculées — c'est cette liste que l'appelant utilise
   * pour dispatcher les mails, sans risquer de relancer un fournisseur déjà
   * notifié.
   */
  async send(rfq: Rfq): Promise<RfqSupplier[]> {
    if (rfq.status !== 'published') throw new RfqNotSendableException()

    const pending = await RfqSupplier.query()
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
   * consultables, aucun nouvel envoi n'est possible.
   */
  async close(rfq: Rfq): Promise<Rfq> {
    if (rfq.status !== 'published') throw new RfqNotClosableException()

    rfq.merge({ status: 'closed', closedAt: DateTime.now() })
    await rfq.save()
    return rfq
  }

  /**
   * Accusé de lecture côté fournisseur : `sent` → `viewed`. Idempotent, et
   * jamais régressif — une demande déjà `responded`/`declined` ne redevient
   * pas « simplement consultée » parce que le fournisseur rouvre l'écran.
   */
  async markViewed(rfq: Rfq, supplierOrganizationId: number): Promise<RfqSupplier> {
    return this.applyViewed(await this.findRecipient(rfq, supplierOrganizationId))
  }

  /**
   * Le fournisseur a déposé un devis (Phase 4) : `sent`/`viewed` → `responded`.
   */
  async markResponded(rfq: Rfq, supplierOrganizationId: number): Promise<RfqSupplier> {
    return this.transitionRecipient(rfq, supplierOrganizationId, 'responded')
  }

  /**
   * Le fournisseur décline la consultation : `sent`/`viewed` → `declined`.
   */
  async decline(rfq: Rfq, supplierOrganizationId: number): Promise<RfqSupplier> {
    return this.transitionRecipient(rfq, supplierOrganizationId, 'declined')
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
   * Accusé de lecture appliqué à une ligne déjà chargée — `openForSupplier`
   * bascule ainsi l'instance **préchargée**, que l'écran va transformer.
   */
  private async applyViewed(target: RfqSupplier): Promise<RfqSupplier> {
    if (target.status === 'sent') {
      target.status = 'viewed'
      await target.save()
    }
    return target
  }

  /**
   * Transition vers un statut terminal côté fournisseur. Refusée si la demande
   * n'a pas été reçue (`pending`) ou si une décision a déjà été prise.
   */
  private async transitionRecipient(
    rfq: Rfq,
    supplierOrganizationId: number,
    status: 'responded' | 'declined'
  ): Promise<RfqSupplier> {
    const target = await this.findRecipient(rfq, supplierOrganizationId)

    if (target.status === 'pending' || TERMINAL_RFQ_SUPPLIER_STATUSES.includes(target.status)) {
      throw new RfqNotEditableException()
    }

    target.status = status
    await target.save()
    return target
  }

  private async findRecipient(rfq: Rfq, supplierOrganizationId: number): Promise<RfqSupplier> {
    const target = await RfqSupplier.query()
      .where('rfqId', rfq.id)
      .where('supplierOrganizationId', supplierOrganizationId)
      .first()

    if (!target) throw new RfqSupplierNotFoundException()
    return target
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

  private parseDeadline(deadline: string | null | undefined): DateTime | null {
    if (!deadline) return null
    const parsed = DateTime.fromISO(deadline)
    return parsed.isValid ? parsed : null
  }
}
