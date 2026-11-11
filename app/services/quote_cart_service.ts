import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import Product from '#models/product'
import ProductMarkingPositionTechnique from '#models/product_marking_position_technique'
import ProductVariant from '#models/product_variant'
import QuoteCartItem from '#models/quote_cart_item'
import type Organization from '#models/organization'
import type Rfq from '#models/rfq'
import type RfqSupplier from '#models/rfq_supplier'
import type User from '#models/user'
import ProductCatalogueService from '#services/product_catalogue_service'
import RfqService from '#services/rfq_service'
import RfqProductOptionTransformer from '#transformers/rfq_product_option_transformer'
import QuoteCartItemTransformer from '#transformers/quote_cart_item_transformer'
import { ProductNotFoundException } from '#exceptions/catalogue_errors'
import {
  QuoteCartDuplicateLineException,
  QuoteCartEmptyException,
  QuoteCartInvalidOptionException,
  QuoteCartItemNotFoundException,
} from '#exceptions/quote_cart_errors'
import { sumEstimates } from '#shared/helpers/price_tiers'
import type { Locale } from '#shared/types/i18n'
import { DEFAULT_RFQ_ITEM_QUANTITY, type RfqItemSpecs } from '#shared/types/rfq'
import type {
  AddQuoteCartItemData,
  QuoteCartCheckoutData,
  QuoteCartGroupType,
  QuoteCartItemType,
  QuoteCartSpecKey,
  UpdateQuoteCartItemData,
} from '#shared/types/quote_cart'

/** Longueur de `rfqs.title` : le suffixe fournisseur ne doit pas la dépasser. */
const RFQ_TITLE_MAX_LENGTH = 180

/** Longueur maximale d'une valeur de `rfq_items.specs` (cf. validateur RFQ). */
const SPEC_VALUE_MAX_LENGTH = 255

/** Organisations à qui une demande peut partir (même règle que `RfqService`). */
const SUPPLIER_ORGANIZATION_TYPES = ['supplier', 'both']

/** Une demande créée par la validation, et les destinataires effectivement notifiés. */
export interface QuoteCartCheckoutOutcome {
  rfq: Rfq
  recipients: RfqSupplier[]
}

/**
 * Panier de devis d'un utilisateur dans son organisation acheteuse.
 *
 * Le panier mélange librement des produits de plusieurs fournisseurs ; c'est à
 * la **validation** qu'il est éclaté en une demande de devis (RFQ) par
 * fournisseur, chacun ne recevant que ses lignes. Toutes les requêtes filtrent
 * sur `(user_id, organization_id)` : la ligne d'un autre panier est un 404.
 */
@inject()
export default class QuoteCartService {
  constructor(
    private rfqs: RfqService,
    private catalogue: ProductCatalogueService
  ) {}

  /** Nombre de lignes — la pastille du bandeau. */
  async count(user: User, organization: Organization): Promise<number> {
    const [{ total }] = await db
      .from('quote_cart_items')
      .where('user_id', user.id)
      .where('organization_id', organization.id)
      .count('* as total')
      .exec()
    return Number(total)
  }

  /**
   * Variantes de ce produit déjà au panier (`null` = ligne sans variante) :
   * la fiche produit en déduit l'état « dans votre panier » de la variante
   * affichée.
   */
  async cartVariantIds(
    user: User,
    organization: Organization,
    productId: number
  ): Promise<(number | null)[]> {
    const items = await this.itemsOf(user, organization)
      .select('variantId')
      .where('productId', productId)
    return items.map((item) => item.variantId)
  }

  /**
   * Ajoute un produit, éventuellement dans une variante. Le produit est relu
   * depuis le catalogue (actif, non rejeté, organisation vivante), la variante
   * doit être une variante active de ce produit ; la quantité par défaut est
   * son minimum de commande. Un couple (produit, variante) déjà présent n'est
   * pas dupliqué : `created` vaut alors `false` et la ligne existante est
   * renvoyée telle quelle.
   */
  async add(
    user: User,
    organization: Organization,
    data: AddQuoteCartItemData
  ): Promise<{ item: QuoteCartItem; product: Product; created: boolean }> {
    const product = await this.catalogue.findForRfq(data.productId)
    if (!product) throw new ProductNotFoundException()

    const variantId = data.variantId ?? null
    if (variantId !== null) await this.assertVariant(product.id, variantId)

    const existing = await this.lineOf(user, organization, product.id, variantId)
    if (existing) return { item: existing, product, created: false }

    const item = await QuoteCartItem.create({
      userId: user.id,
      organizationId: organization.id,
      productId: product.id,
      variantId,
      markingPositionTechniqueId: null,
      markingColors: null,
      quantity: data.quantity ?? product.minQuantity ?? DEFAULT_RFQ_ITEM_QUANTITY,
      note: null,
    })
    return { item, product, created: true }
  }

  /**
   * Modifie quantité, précisions et options d'une ligne. Chaque option est
   * contrôlée contre le produit de la ligne (variante active, marquage d'une
   * de ses positions, couleurs ≤ maximum de la technique) ; retirer le
   * marquage efface le nombre de couleurs.
   */
  async updateItem(
    user: User,
    organization: Organization,
    id: number,
    data: UpdateQuoteCartItemData
  ): Promise<QuoteCartItem> {
    const item = await this.findItem(user, organization, id)

    if (data.variantId !== undefined && data.variantId !== item.variantId) {
      if (data.variantId !== null) await this.assertVariant(item.productId, data.variantId)
      const clash = await this.lineOf(user, organization, item.productId, data.variantId)
      if (clash) throw new QuoteCartDuplicateLineException()
      item.variantId = data.variantId
    }

    if (data.markingPositionTechniqueId !== undefined) {
      if (data.markingPositionTechniqueId === null) {
        item.markingPositionTechniqueId = null
        item.markingColors = null
      } else if (data.markingPositionTechniqueId !== item.markingPositionTechniqueId) {
        await this.findMarking(item.productId, data.markingPositionTechniqueId)
        item.markingPositionTechniqueId = data.markingPositionTechniqueId
      }
    }

    if (data.markingColors !== undefined) item.markingColors = data.markingColors
    if (item.markingColors !== null) {
      // Des couleurs sans marquage, ou au-delà du maximum de la technique, n'ont pas de sens.
      if (item.markingPositionTechniqueId === null) throw new QuoteCartInvalidOptionException()
      const marking = await this.findMarking(item.productId, item.markingPositionTechniqueId)
      if (marking.maxColors !== null && item.markingColors > marking.maxColors) {
        throw new QuoteCartInvalidOptionException()
      }
    }

    item.merge({
      ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
      ...(data.note !== undefined ? { note: data.note } : {}),
    })
    await item.save()
    return item
  }

  async removeItem(user: User, organization: Organization, id: number): Promise<void> {
    const item = await this.findItem(user, organization, id)
    await item.delete()
  }

  /**
   * Lignes du panier groupées par organisation fournisseuse, dans l'ordre
   * d'ajout. Les produits devenus indemandables (désactivés, rejetés) ou dont
   * le fournisseur n'a pas de compte éligible forment le groupe
   * `supplierOrganizationId: null`, toujours placé en dernier.
   */
  async list(
    user: User,
    organization: Organization,
    locale: Locale
  ): Promise<QuoteCartGroupType[]> {
    const items = await this.loadItems(user, organization)
    const reachable = await this.reachableProductIds(items)
    const groups = new Map<number | null, QuoteCartGroupType>()

    for (const item of items) {
      const option = new RfqProductOptionTransformer(item.product, locale).toObject()
      const supplierId = reachable.has(item.productId) ? option.supplierOrganizationId : null
      const group = groups.get(supplierId) ?? {
        supplierOrganizationId: supplierId,
        supplierName: supplierId === null ? null : option.supplierName,
        items: [],
        subtotals: [],
        estimateComplete: true,
      }
      group.items.push(new QuoteCartItemTransformer(item, locale).toObject())
      groups.set(supplierId, group)
    }

    for (const group of groups.values()) {
      const { subtotals, complete } = sumEstimates(group.items.map((line) => line.estimate))
      group.subtotals = subtotals
      group.estimateComplete = complete
    }

    const unreachable = groups.get(null)
    groups.delete(null)
    return [...groups.values(), ...(unreachable ? [unreachable] : [])]
  }

  /**
   * Valide le panier : **une demande par fournisseur**, en tout ou rien.
   * Chaque demande reçoit l'en-tête commun (titre suffixé du nom du
   * fournisseur, description, échéance), ses seules lignes, et ce fournisseur
   * pour unique destinataire. Avec `send`, elle est aussitôt publiée et
   * envoyée ; sans (un `member`, qui rédige mais n'envoie pas), elle reste en
   * brouillon. Les lignes validées quittent le panier ; le groupe non joignable
   * y reste.
   *
   * Les notifications (`RfqSent`) sont à émettre par l'appelant **après** le
   * retour : la transaction est alors commitée.
   */
  async checkout(
    user: User,
    organization: Organization,
    data: QuoteCartCheckoutData,
    options: { send: boolean; locale: Locale }
  ): Promise<QuoteCartCheckoutOutcome[]> {
    const cart = await this.list(user, organization, options.locale)
    const groups = cart.filter((group) => group.supplierOrganizationId !== null)
    if (groups.length === 0) throw new QuoteCartEmptyException()

    const categories = await this.categoriesOf(groups)

    return db.transaction(async (trx) => {
      const outcomes: QuoteCartCheckoutOutcome[] = []

      for (const group of groups) {
        const rfq = await this.rfqs.create(
          organization,
          user,
          {
            title: this.titleFor(data.title, group.supplierName),
            description: data.description ?? null,
            deadline: data.deadline ?? null,
            items: group.items.map((item) => ({
              name: item.productName,
              description: item.note,
              quantity: item.quantity,
              categoryId: categories.get(item.productId) ?? null,
              productId: item.productId,
              specs: this.specsFor(item),
            })),
          },
          trx
        )
        await this.rfqs.addSuppliers(rfq, [group.supplierOrganizationId!], trx)

        let recipients: RfqSupplier[] = []
        if (options.send) {
          await this.rfqs.publish(rfq, trx)
          recipients = await this.rfqs.send(rfq, trx)
        }
        outcomes.push({ rfq, recipients })
      }

      const checkedOut = groups.flatMap((group) => group.items.map((item) => item.id))
      await QuoteCartItem.query({ client: trx }).whereIn('id', checkedOut).delete()

      return outcomes
    })
  }

  private itemsOf(user: User, organization: Organization) {
    return QuoteCartItem.query().where('userId', user.id).where('organizationId', organization.id)
  }

  private async findItem(user: User, organization: Organization, id: number) {
    const item = await this.itemsOf(user, organization).where('id', id).first()
    if (!item) throw new QuoteCartItemNotFoundException()
    return item
  }

  /** Ligne d'un couple (produit, variante), `variantId` null compris. */
  private lineOf(
    user: User,
    organization: Organization,
    productId: number,
    variantId: number | null
  ): Promise<QuoteCartItem | null> {
    const query = this.itemsOf(user, organization).where('productId', productId)
    if (variantId === null) query.whereNull('variantId')
    else query.where('variantId', variantId)
    return query.first()
  }

  /** La variante doit être une variante active du produit. */
  private async assertVariant(productId: number, variantId: number): Promise<void> {
    const variant = await ProductVariant.query()
      .select('id')
      .where('id', variantId)
      .where('productId', productId)
      .where('isActive', true)
      .first()
    if (!variant) throw new QuoteCartInvalidOptionException()
  }

  /** Technique d'une position de marquage du produit, sinon option refusée. */
  private async findMarking(
    productId: number,
    markingPositionTechniqueId: number
  ): Promise<ProductMarkingPositionTechnique> {
    const marking = await ProductMarkingPositionTechnique.query()
      .where('id', markingPositionTechniqueId)
      .whereHas('markingPosition', (position) => position.where('productId', productId))
      .first()
    if (!marking) throw new QuoteCartInvalidOptionException()
    return marking
  }

  private loadItems(user: User, organization: Organization): Promise<QuoteCartItem[]> {
    return this.itemsOf(user, organization)
      .preload('product', (product) =>
        product
          .preload('translations')
          .preload('supplier', (supplier) => supplier.preload('organization'))
          .preload('priceTiers', (tiers) => tiers.orderBy('minQuantity'))
          .preload('variants', (variants) =>
            variants
              .where('isActive', true)
              .orderBy('id')
              .preload('attributes', (pivot) =>
                pivot
                  .preload('attribute', (attribute) => attribute.preload('translations'))
                  .preload('attributeValue', (value) => value.preload('translations'))
              )
          )
          .preload('markingPositions', (positions) =>
            positions
              .orderBy('position')
              .preload('techniques', (techniques) =>
                techniques
                  .orderBy('id')
                  .preload('technique', (technique) => technique.preload('translations'))
              )
          )
          .preload('markingPriceTiers', (tiers) => tiers.orderBy('minQuantity'))
      )
      .orderBy('createdAt', 'asc')
      .orderBy('id', 'asc')
  }

  /**
   * Produits encore demandables (actifs, non rejetés, organisation vivante) et
   * dont l'organisation fournisseuse est éligible comme destinataire.
   */
  private async reachableProductIds(items: QuoteCartItem[]): Promise<Set<number>> {
    const ids = items.map((item) => item.productId)
    if (ids.length === 0) return new Set()

    const visible = await Product.query()
      .select('products.id')
      .whereIn('products.id', ids)
      .where('isActive', true)
      .withScopes((scopes) => {
        scopes.fromLiveOrganization()
        scopes.notRejected()
      })
      .whereHas('supplier', (supplier) =>
        supplier.whereHas('organization', (org) =>
          org.whereIn('organizationType', SUPPLIER_ORGANIZATION_TYPES).whereNull('archivedAt')
        )
      )
    return new Set(visible.map((product) => product.id))
  }

  /** Catégorie de chaque produit validé, pour cadrer les lignes de la demande. */
  private async categoriesOf(groups: QuoteCartGroupType[]): Promise<Map<number, number | null>> {
    const ids = groups.flatMap((group) => group.items.map((item) => item.productId))
    const products = await Product.query().select('id', 'categoryId').whereIn('id', ids)
    return new Map(products.map((product) => [product.id, product.categoryId ?? null]))
  }

  /**
   * Options et estimation transmises au fournisseur dans `rfq_items.specs`,
   * à clés stables (libellées par `rfq.specs.<clé>` à l'affichage). Seules les
   * valeurs connues sont posées ; `null` si la ligne n'a ni option ni prix.
   */
  private specsFor(item: QuoteCartItemType): RfqItemSpecs | null {
    const specs: Partial<Record<QuoteCartSpecKey, string>> = {}
    const variant = item.variantOptions.find((candidate) => candidate.id === item.variantId)
    if (variant) {
      specs.variant = variant.label
      specs.sku = variant.sku
    }
    const marking = item.markingOptions.find(
      (candidate) => candidate.id === item.markingPositionTechniqueId
    )
    if (marking) {
      specs.markingPosition = marking.positionName
      specs.markingTechnique = marking.techniqueName
      if (item.markingColors !== null) specs.markingColors = String(item.markingColors)
    }
    const estimate = item.estimate
    if (estimate) {
      const money = (value: string | null) =>
        value === null ? null : `${value} ${estimate.currency}`
      const prices: [QuoteCartSpecKey, string | null][] = [
        ['estimatedUnitPrice', money(estimate.unitPrice)],
        ['estimatedMarkingUnitPrice', money(estimate.markingUnitPrice)],
        ['estimatedSetupCharge', money(estimate.setupCharge)],
        // Un total qui ignore le marquage (prix inconnu) induirait en erreur.
        ['estimatedTotal', estimate.partial ? null : money(estimate.total)],
      ]
      for (const [key, value] of prices) if (value !== null) specs[key] = value
    }

    const entries = Object.entries(specs).map(([key, value]) => [
      key,
      value.slice(0, SPEC_VALUE_MAX_LENGTH),
    ])
    return entries.length > 0 ? Object.fromEntries(entries) : null
  }

  private titleFor(title: string, supplierName: string | null): string {
    const full = supplierName ? `${title} — ${supplierName}` : title
    return full.slice(0, RFQ_TITLE_MAX_LENGTH)
  }
}
