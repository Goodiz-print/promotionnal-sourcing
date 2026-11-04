import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { adminActionContext } from '#services/admin_audit_service'
import AdminProductActionService from '#services/admin_product_action_service'
import { adminProductHideValidator } from '#validators/admin_product'
import {
  ProductAlreadyHiddenException,
  ProductNotHiddenException,
  ProductAlreadyUnpublishedException,
  ProductAlreadyPublishedException,
  ProductAlreadyArchivedException,
  ProductNotArchivedException,
} from '#exceptions/admin_product_errors'

/**
 * Actions d'administration sur les produits (#164) : masquage, depublication,
 * archivage, reindexation. Droit `products.manage` (admin seul).
 */
@inject()
export default class ProductManagementController {
  constructor(private actions: AdminProductActionService) {}

  /**
   * Masque un produit (decision de moderation `rejected`).
   */
  async hide(ctx: HttpContext) {
    const { bouncer, request, response, params, i18n, session, auth } = ctx
    await bouncer.authorize('hasPlatformPermission', 'products.manage')

    const { reason } = await request.validateUsing(adminProductHideValidator)

    try {
      await this.actions.hide(Number(params.id), {
        context: adminActionContext(ctx),
        reason,
        decidedBy: auth.user!,
      })
    } catch (error) {
      if (error instanceof ProductAlreadyHiddenException) {
        session.flash('error', i18n.t('admin.products.actions.hide.alreadyHidden'))
        return response.redirect().back()
      }
      throw error
    }

    session.flash('success', i18n.t('admin.products.actions.hide.done'))
    return response.redirect().back()
  }

  /**
   * Revele un produit masque (decision de moderation `approved`).
   */
  async unhide(ctx: HttpContext) {
    const { bouncer, response, params, i18n, session, auth } = ctx
    await bouncer.authorize('hasPlatformPermission', 'products.manage')

    try {
      await this.actions.unhide(Number(params.id), {
        context: adminActionContext(ctx),
        decidedBy: auth.user!,
      })
    } catch (error) {
      if (error instanceof ProductNotHiddenException) {
        session.flash('error', i18n.t('admin.products.actions.unhide.notHidden'))
        return response.redirect().back()
      }
      throw error
    }

    session.flash('success', i18n.t('admin.products.actions.unhide.done'))
    return response.redirect().back()
  }

  /**
   * Depublie un produit (is_active=false).
   */
  async unpublish(ctx: HttpContext) {
    const { bouncer, response, params, i18n, session } = ctx
    await bouncer.authorize('hasPlatformPermission', 'products.manage')

    try {
      await this.actions.unpublish(Number(params.id), {
        context: adminActionContext(ctx),
      })
    } catch (error) {
      if (error instanceof ProductAlreadyUnpublishedException) {
        session.flash('error', i18n.t('admin.products.actions.unpublish.alreadyUnpublished'))
        return response.redirect().back()
      }
      throw error
    }

    session.flash('success', i18n.t('admin.products.actions.unpublish.done'))
    return response.redirect().back()
  }

  /**
   * Publie un produit (is_active=true).
   */
  async publish(ctx: HttpContext) {
    const { bouncer, response, params, i18n, session } = ctx
    await bouncer.authorize('hasPlatformPermission', 'products.manage')

    try {
      await this.actions.publish(Number(params.id), {
        context: adminActionContext(ctx),
      })
    } catch (error) {
      if (error instanceof ProductAlreadyPublishedException) {
        session.flash('error', i18n.t('admin.products.actions.publish.alreadyPublished'))
        return response.redirect().back()
      }
      throw error
    }

    session.flash('success', i18n.t('admin.products.actions.publish.done'))
    return response.redirect().back()
  }

  /**
   * Archive un produit (lifecycle_status='retired' ET is_active=false).
   */
  async archive(ctx: HttpContext) {
    const { bouncer, response, params, i18n, session } = ctx
    await bouncer.authorize('hasPlatformPermission', 'products.manage')

    try {
      await this.actions.archive(Number(params.id), {
        context: adminActionContext(ctx),
      })
    } catch (error) {
      if (error instanceof ProductAlreadyArchivedException) {
        session.flash('error', i18n.t('admin.products.actions.archive.alreadyArchived'))
        return response.redirect().back()
      }
      throw error
    }

    session.flash('success', i18n.t('admin.products.actions.archive.done'))
    return response.redirect().back()
  }

  /**
   * Restaure un produit archive (lifecycle_status='active').
   */
  async restore(ctx: HttpContext) {
    const { bouncer, response, params, i18n, session } = ctx
    await bouncer.authorize('hasPlatformPermission', 'products.manage')

    try {
      await this.actions.restore(Number(params.id), {
        context: adminActionContext(ctx),
      })
    } catch (error) {
      if (error instanceof ProductNotArchivedException) {
        session.flash('error', i18n.t('admin.products.actions.restore.notArchived'))
        return response.redirect().back()
      }
      throw error
    }

    session.flash('success', i18n.t('admin.products.actions.restore.done'))
    return response.redirect().back()
  }

  /**
   * Demande une reindexation du produit.
   */
  async reindex(ctx: HttpContext) {
    const { bouncer, response, params, i18n, session } = ctx
    await bouncer.authorize('hasPlatformPermission', 'products.manage')

    await this.actions.reindex(Number(params.id), {
      context: adminActionContext(ctx),
    })

    session.flash('success', i18n.t('admin.products.actions.reindex.done'))
    return response.redirect().back()
  }
}
