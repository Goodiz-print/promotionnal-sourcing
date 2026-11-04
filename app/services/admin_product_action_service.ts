import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import emitter from '@adonisjs/core/services/emitter'
import logger from '@adonisjs/core/services/logger'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AdminAuditService from '#services/admin_audit_service'
import ModerationService from '#services/moderation_service'
import SearchSyncService from '#services/search_sync_service'
import ProductChanged from '#events/product_changed'
import Product from '#models/product'
import User from '#models/user'
import { AdminProductNotFoundException } from '#exceptions/admin_product_errors'
import {
  ProductAlreadyHiddenException,
  ProductNotHiddenException,
  ProductAlreadyUnpublishedException,
  ProductAlreadyPublishedException,
  ProductAlreadyArchivedException,
  ProductArchivedException,
  ProductNotArchivedException,
} from '#exceptions/admin_product_errors'
import { latestDecisionIsRejectedSql } from '#shared/helpers/moderation'
import type { AdminActionContext } from '#shared/types/admin_audit'

interface ActionOptions {
  context: AdminActionContext
}

interface HideOptions extends ActionOptions {
  reason: string
  decidedBy: User
}

interface UnhideOptions extends ActionOptions {
  decidedBy: User
}

/**
 * Actions d'administration sur les produits (#164) : masquage, dépublication,
 * archivage, réindexation. Chaque action est auditée **dans la même transaction**.
 */
@inject()
export default class AdminProductActionService {
  constructor(
    private moderation: ModerationService,
    private audit: AdminAuditService,
    private searchSync: SearchSyncService
  ) {}

  /**
   * Masque un produit via une décision de modération `rejected`.
   * Idempotence : masquer un produit déjà masqué renvoie 409.
   */
  async hide(productId: number, options: HideOptions): Promise<Product> {
    return db.transaction(async (trx) => {
      const product = await this.lockOrFail(productId, trx)

      // Vérifier si déjà masqué
      const isRejected = await this.isLatestDecisionRejected(productId, trx)
      if (isRejected) throw new ProductAlreadyHiddenException()

      // Enregistre la décision de modération
      await this.moderation.decide(
        {
          targetType: 'product',
          targetId: productId,
          status: 'rejected',
          decidedBy: options.decidedBy,
          reason: options.reason,
        },
        trx
      )

      await this.audit.record(
        {
          action: 'product.hidden',
          targetType: 'product',
          targetId: productId,
          changes: { before: { hidden: false }, after: { hidden: true, reason: options.reason } },
        },
        { ...options.context, client: trx }
      )

      return product
    })
  }

  /**
   * Révèle un produit masqué via une décision de modération `approved`.
   * Idempotence : révéler un produit non masqué renvoie 409.
   */
  async unhide(productId: number, options: UnhideOptions): Promise<Product> {
    return db.transaction(async (trx) => {
      const product = await this.lockOrFail(productId, trx)

      // Vérifier si masqué
      const isRejected = await this.isLatestDecisionRejected(productId, trx)
      if (!isRejected) throw new ProductNotHiddenException()

      // Enregistre la décision de modération
      await this.moderation.decide(
        {
          targetType: 'product',
          targetId: productId,
          status: 'approved',
          decidedBy: options.decidedBy,
        },
        trx
      )

      await this.audit.record(
        {
          action: 'product.unhidden',
          targetType: 'product',
          targetId: productId,
          changes: { before: { hidden: true }, after: { hidden: false } },
        },
        { ...options.context, client: trx }
      )

      return product
    })
  }

  /**
   * Dépublie un produit (is_active=false).
   * Idempotence : dépublier un produit déjà dépublié renvoie 409.
   */
  async unpublish(productId: number, options: ActionOptions): Promise<Product> {
    const product = await db.transaction(async (trx) => {
      const p = await this.lockOrFail(productId, trx)

      if (!p.isActive) throw new ProductAlreadyUnpublishedException()

      p.useTransaction(trx)
      p.isActive = false
      await p.save()

      await this.audit.record(
        {
          action: 'product.unpublished',
          targetType: 'product',
          targetId: productId,
          changes: {
            before: { isActive: true },
            after: { isActive: false },
          },
        },
        { ...options.context, client: trx }
      )

      // Réindexation après le commit
      trx.after('commit', () => this.emitProductChanged(productId))

      return p
    })

    return product
  }

  /**
   * Publie un produit (is_active=true).
   * Idempotence : publier un produit déjà publié renvoie 409.
   */
  async publish(productId: number, options: ActionOptions): Promise<Product> {
    const product = await db.transaction(async (trx) => {
      const p = await this.lockOrFail(productId, trx)

      // Un produit archivé (`retired`) n'est masqué du public que par `is_active` :
      // le republier sans le restaurer le remettrait en ligne.
      if (p.lifecycleStatus === 'retired') throw new ProductArchivedException()
      if (p.isActive) throw new ProductAlreadyPublishedException()

      p.useTransaction(trx)
      p.isActive = true
      await p.save()

      await this.audit.record(
        {
          action: 'product.published',
          targetType: 'product',
          targetId: productId,
          changes: {
            before: { isActive: false },
            after: { isActive: true },
          },
        },
        { ...options.context, client: trx }
      )

      // Réindexation après le commit
      trx.after('commit', () => this.emitProductChanged(productId))

      return p
    })

    return product
  }

  /**
   * Archive un produit (lifecycle_status='retired' ET is_active=false).
   * Idempotence : archiver un produit déjà archivé renvoie 409.
   */
  async archive(productId: number, options: ActionOptions): Promise<Product> {
    const product = await db.transaction(async (trx) => {
      const p = await this.lockOrFail(productId, trx)

      if (p.lifecycleStatus === 'retired') throw new ProductAlreadyArchivedException()

      const previousStatus = p.lifecycleStatus
      const wasActive = p.isActive

      p.useTransaction(trx)
      p.lifecycleStatus = 'retired'
      p.isActive = false
      await p.save()

      await this.audit.record(
        {
          action: 'product.archived',
          targetType: 'product',
          targetId: productId,
          changes: {
            before: { lifecycleStatus: previousStatus, isActive: wasActive },
            after: { lifecycleStatus: 'retired', isActive: false },
          },
        },
        { ...options.context, client: trx }
      )

      // Réindexation après le commit
      trx.after('commit', () => this.emitProductChanged(productId))

      return p
    })

    return product
  }

  /**
   * Restaure un produit archivé (lifecycle_status='active', is_active inchangé).
   * Note : le produit reste dépublié si is_active=false, il faut le publier séparément.
   * Idempotence : restaurer un produit non archivé renvoie 409.
   */
  async restore(productId: number, options: ActionOptions): Promise<Product> {
    const product = await db.transaction(async (trx) => {
      const p = await this.lockOrFail(productId, trx)

      if (p.lifecycleStatus !== 'retired') throw new ProductNotArchivedException()

      p.useTransaction(trx)
      p.lifecycleStatus = 'active'
      // Note : on ne change pas is_active, le produit reste dépublié
      await p.save()

      await this.audit.record(
        {
          action: 'product.restored',
          targetType: 'product',
          targetId: productId,
          changes: {
            before: { lifecycleStatus: 'retired' },
            after: { lifecycleStatus: 'active' },
          },
        },
        { ...options.context, client: trx }
      )

      // Réindexation après le commit (le produit revient potentiellement dans l'index)
      trx.after('commit', () => this.emitProductChanged(productId))

      return p
    })

    return product
  }

  /**
   * Demande une réindexation du produit.
   */
  async reindex(productId: number, options: ActionOptions): Promise<Product> {
    const product = await db.transaction(async (trx) => {
      const p = await this.lockOrFail(productId, trx)

      await this.audit.record(
        {
          action: 'product.reindex_requested',
          targetType: 'product',
          targetId: productId,
          changes: {},
        },
        { ...options.context, client: trx }
      )

      // Réindexation après le commit
      trx.after('commit', () => this.searchSync.queueProduct(productId))

      return p
    })

    return product
  }

  /**
   * Charge le produit **verrouille** (`FOR UPDATE`) dans la transaction :
   * deux actions simultanées sont sérialisées et l'état relu est celui qui sera
   * effectivement modifié.
   */
  private async lockOrFail(id: number, trx: TransactionClientContract): Promise<Product> {
    const product = await Product.query({ client: trx }).where('id', id).forUpdate().first()
    if (!product) throw new AdminProductNotFoundException()
    return product
  }

  private async isLatestDecisionRejected(
    productId: number,
    trx: TransactionClientContract
  ): Promise<boolean> {
    // `productId` est un entier déjà validé : le helper répète la colonne dans
    // deux sous-requêtes, un binding unique ne suffirait pas.
    const result = await trx.rawQuery(
      `SELECT ${latestDecisionIsRejectedSql('product', String(Math.trunc(productId)))} AS is_rejected`
    )
    return result.rows[0]?.is_rejected === true
  }

  private emitProductChanged(productId: number): void {
    // La base est déjà à jour : un échec d'émission est loggé sans être propagé,
    // `search:reindex` (ou l'action « Réindexer ») rattrape l'index.
    emitter.emit(ProductChanged, new ProductChanged(productId)).catch((error) => {
      logger.warn({ err: error, productId }, 'failed to emit product change')
    })
  }
}
