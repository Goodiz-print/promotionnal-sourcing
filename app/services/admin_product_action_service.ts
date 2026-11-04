import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import emitter from '@adonisjs/core/services/emitter'
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
 * Actions d'administration sur les produits (#164) : masquage, depublication,
 * archivage, reindexation. Chaque action est auditee **dans la meme transaction**.
 */
@inject()
export default class AdminProductActionService {
  constructor(
    private moderation: ModerationService,
    private audit: AdminAuditService,
    private searchSync: SearchSyncService
  ) {}

  /**
   * Masque un produit via une decision de moderation `rejected`.
   * Idempotence : masquer un produit deja masque renvoie 409.
   */
  async hide(productId: number, options: HideOptions): Promise<Product> {
    return db.transaction(async (trx) => {
      const product = await this.lockOrFail(productId, trx)

      // Verifier si deja masque
      const isRejected = await this.isLatestDecisionRejected(productId, trx)
      if (isRejected) throw new ProductAlreadyHiddenException()

      // Enregistre la decision de moderation
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
          changes: { after: { hidden: true, reason: options.reason } },
        },
        { ...options.context, client: trx }
      )

      return product
    })
  }

  /**
   * Revele un produit masque via une decision de moderation `approved`.
   * Idempotence : reveler un produit non masque renvoie 409.
   */
  async unhide(productId: number, options: UnhideOptions): Promise<Product> {
    return db.transaction(async (trx) => {
      const product = await this.lockOrFail(productId, trx)

      // Verifier si masque
      const isRejected = await this.isLatestDecisionRejected(productId, trx)
      if (!isRejected) throw new ProductNotHiddenException()

      // Enregistre la decision de moderation
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
          changes: { after: { hidden: false } },
        },
        { ...options.context, client: trx }
      )

      return product
    })
  }

  /**
   * Depublie un produit (is_active=false).
   * Idempotence : depublier un produit deja depublie renvoie 409.
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

      // Reindexation apres le commit
      trx.after('commit', () => this.emitProductChanged(productId))

      return p
    })

    return product
  }

  /**
   * Publie un produit (is_active=true).
   * Idempotence : publier un produit deja publie renvoie 409.
   */
  async publish(productId: number, options: ActionOptions): Promise<Product> {
    const product = await db.transaction(async (trx) => {
      const p = await this.lockOrFail(productId, trx)

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

      // Reindexation apres le commit
      trx.after('commit', () => this.emitProductChanged(productId))

      return p
    })

    return product
  }

  /**
   * Archive un produit (lifecycle_status='retired' ET is_active=false).
   * Idempotence : archiver un produit deja archive renvoie 409.
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

      // Reindexation apres le commit
      trx.after('commit', () => this.emitProductChanged(productId))

      return p
    })

    return product
  }

  /**
   * Restaure un produit archive (lifecycle_status='active', is_active inchange).
   * Note : le produit reste depublie si is_active=false, il faut le publier separement.
   * Idempotence : restaurer un produit non archive renvoie 409.
   */
  async restore(productId: number, options: ActionOptions): Promise<Product> {
    const product = await db.transaction(async (trx) => {
      const p = await this.lockOrFail(productId, trx)

      if (p.lifecycleStatus !== 'retired') throw new ProductNotArchivedException()

      p.useTransaction(trx)
      p.lifecycleStatus = 'active'
      // Note : on ne change pas is_active, le produit reste depublie
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

      // Reindexation apres le commit (le produit revient potentiellement dans l'index)
      trx.after('commit', () => this.emitProductChanged(productId))

      return p
    })

    return product
  }

  /**
   * Demande une reindexation du produit.
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

      // Reindexation apres le commit
      trx.after('commit', () => this.searchSync.queueProduct(productId))

      return p
    })

    return product
  }

  /**
   * Charge le produit **verrouille** (`FOR UPDATE`) dans la transaction :
   * deux actions simultanees sont serialisees et l'etat relu est celui qui sera
   * effectivement modifie.
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
    emitter.emit(ProductChanged, new ProductChanged(productId)).catch(() => {
      // L'emission ne doit pas bloquer
    })
  }
}
