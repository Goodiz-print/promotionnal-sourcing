import { DateTime } from 'luxon'
import type { HasManyQueryBuilderContract } from '@adonisjs/lucid/types/relations'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'
import Organization from '#models/organization'
import Product from '#models/product'
import Rfq from '#models/rfq'
import RfqItem from '#models/rfq_item'
import RfqSupplier from '#models/rfq_supplier'
import type User from '#models/user'
import {
  NotASupplierOrganizationException,
  RfqInvalidDeadlineException,
  RfqNotClosableException,
  RfqNotEditableException,
  RfqNotExpirableException,
  RfqNotExtendableException,
  RfqNotFoundException,
  RfqNotPublishableException,
  RfqNotSendableException,
  RfqSupplierNotFoundException,
} from '#exceptions/rfq_errors'
import {
  DEFAULT_RFQ_ITEM_QUANTITY,
  RFQ_DEADLINE_TIMEZONE,
  RFQ_REMINDER_AFTER_DAYS,
  TERMINAL_RFQ_SUPPLIER_STATUSES,
} from '#shared/types/rfq'
import type {
  CreateRfqData,
  ExtendRfqDeadlineData,
  RfqItemData,
  RfqProductOptionType,
  UpdateRfqData,
} from '#shared/types/rfq'

/**
 * Cycle de vie d'une demande de devis (RFQ).
 *
 * ```
 * draft ──publish──▶ published ──close──▶ closed
 *                        │  ▲
 *                        │  └──extendDeadline── expired
 *                        ├──expire (échéance dépassée)──▶ expired
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
 * réécrire silencieusement fausserait les devis reçus. **Une seule exception** :
 * l'échéance se prolonge (`extendDeadline`) tant que la demande est publiée ou
 * échue — elle ne change pas le besoin, seulement le temps laissé pour y répondre.
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
  async create(organization: Organization, user: User, data: CreateRfqData): Promise<Rfq> {
    const requestable = await this.withRequestableProducts(data.items ?? [])

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

      if (requestable.length) {
        await RfqItem.createMany(
          requestable.map((item) => this.itemAttributes(rfq.id, item)),
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
   * Brouillons de l'organisation, du plus récent au plus ancien — le menu
   * « ajouter à une demande » de la fiche produit.
   */
  async listDrafts(organizationId: number): Promise<Rfq[]> {
    return Rfq.query()
      .where('buyerOrganizationId', organizationId)
      .where('status', 'draft')
      .orderBy('createdAt', 'desc')
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
   * Bascule une demande publiée en `expired`. Les destinataires gardent leur
   * statut : c'est la trace de qui avait lu, répondu ou décliné.
   */
  async expire(rfq: Rfq, now: DateTime = DateTime.now()): Promise<Rfq> {
    if (rfq.status !== 'published') throw new RfqNotExpirableException()

    rfq.merge({ status: 'expired', expiredAt: now })
    await rfq.save()
    return rfq
  }

  /**
   * Fait expirer toutes les demandes publiées dont l'échéance est dépassée.
   * Appelé par `ExpireRfqsJob` ; renvoie les demandes basculées.
   *
   * L'échéance est une **date** : la demande est échue le lendemain à 00:00,
   * heure de Paris (`RFQ_DEADLINE_TIMEZONE`). Un brouillon, une demande close
   * ou sans échéance n'expirent jamais.
   */
  async expireDue(now: DateTime = DateTime.now()): Promise<Rfq[]> {
    const due = await Rfq.query()
      .where('status', 'published')
      .whereNotNull('deadline')
      .where('deadline', '<', this.startOfToday(now).toSQL()!)

    for (const rfq of due) await this.expire(rfq, now)
    return due
  }

  /**
   * Prolonge l'échéance d'une demande publiée ou échue — et **seulement**
   * l'échéance. Sur une demande échue, la nouvelle date la rouvre : elle
   * repasse `published` et les fournisseurs peuvent répondre de nouveau.
   *
   * « Prolonger » ne raccourcit jamais : la nouvelle date ne peut être ni passée
   * ni antérieure ou égale à l'échéance actuelle.
   */
  async extendDeadline(
    rfq: Rfq,
    data: ExtendRfqDeadlineData,
    now: DateTime = DateTime.now()
  ): Promise<Rfq> {
    if (rfq.status !== 'published' && rfq.status !== 'expired') {
      throw new RfqNotExtendableException()
    }

    const deadline = this.parseDeadline(data.deadline)
    if (!deadline) throw new RfqInvalidDeadlineException()
    if (deadline < this.startOfToday(now)) throw new RfqInvalidDeadlineException()
    if (rfq.deadline && deadline <= rfq.deadline) throw new RfqInvalidDeadlineException()

    rfq.merge({
      deadline,
      ...(rfq.status === 'expired' ? { status: 'published' as const, expiredAt: null } : {}),
    })
    await rfq.save()
    return rfq
  }

  /**
   * Destinataires à relancer : ils ont reçu la demande (`sent`) mais ne l'ont
   * **jamais ouverte** (`viewed` les exclut), il y a au moins
   * `RFQ_REMINDER_AFTER_DAYS` jours, et ne l'ont pas déjà été (`reminded_at`).
   * La demande doit encore être ouverte : publiée et non échue — relancer pour
   * une échéance passée serait absurde. Préchargés : `rfq` (avec l'acheteur) et
   * `supplierOrganization`, ce dont `RfqNotificationService#remind` a besoin.
   */
  dueForReminder(now: DateTime = DateTime.now()): Promise<RfqSupplier[]> {
    const sentBefore = now.minus({ days: RFQ_REMINDER_AFTER_DAYS })
    const today = this.startOfToday(now)

    return RfqSupplier.query()
      .where('status', 'sent')
      .whereNull('remindedAt')
      .where('sentAt', '<=', sentBefore.toSQL()!)
      .whereHas('rfq', (rfq) =>
        rfq
          .where('status', 'published')
          .where((open) => open.whereNull('deadline').orWhere('deadline', '>=', today.toSQL()!))
      )
      .preload('rfq', (rfq) => rfq.preload('buyerOrganization'))
      .preload('supplierOrganization')
      .orderBy('id')
  }

  /**
   * Consigne la relance d'un destinataire : c'est ce qui la rend unique.
   */
  async markReminded(recipient: RfqSupplier, now: DateTime = DateTime.now()): Promise<void> {
    recipient.remindedAt = now
    await recipient.save()
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
    // Une demande échue n'attend plus de réponse : décliner ou chiffrer est refusé.
    if (rfq.status === 'expired') throw new RfqNotEditableException()

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

  /**
   * Minuit, heure de Paris, du jour de `now` : une échéance strictement
   * antérieure est passée (cf. `RFQ_DEADLINE_TIMEZONE`).
   */
  private startOfToday(now: DateTime): DateTime {
    return now.setZone(RFQ_DEADLINE_TIMEZONE).startOf('day')
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
