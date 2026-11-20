import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { adminActionContext } from '#services/admin_audit_service'
import AdminSupplierLinkService from '#services/admin_supplier_link_service'
import {
  SupplierAlreadyLinkedException,
  SupplierLinkOrganizationInvalidException,
  SupplierNotLinkedException,
} from '#exceptions/supplier_link_errors'
import {
  supplierLinkFiltersValidator,
  supplierLinkValidator,
} from '#validators/admin_supplier_link'
import type { AdminSupplierLinkFilters } from '#shared/types/supplier_link'

const PER_PAGE = 25

/** Refus métier d'un rattachement → clé du message flash. */
const LINK_ERRORS = [
  [SupplierAlreadyLinkedException, 'admin.supplierLinks.errors.alreadyLinked'],
  [SupplierLinkOrganizationInvalidException, 'admin.supplierLinks.errors.invalidOrganization'],
  [SupplierNotLinkedException, 'admin.supplierLinks.errors.notLinked'],
] as const

function linkErrorKey(error: unknown): string | null {
  return LINK_ERRORS.find(([type]) => error instanceof type)?.[1] ?? null
}

/**
 * Rattachement des fiches fournisseur importées à l'organisation du
 * fournisseur (#231) : fiches en attente d'accord avec l'organisation
 * proposée, fiches rattachées, actions rattacher / détacher. Droit
 * `organizations.manage` (admin seul) : le rattachement publie un catalogue.
 */
@inject()
export default class SupplierLinkController {
  constructor(private service: AdminSupplierLinkService) {}

  async index({ bouncer, inertia, request, i18n }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'organizations.manage')

    const query = await request.validateUsing(supplierLinkFiltersValidator, {
      data: request.qs(),
    })
    const filters: AdminSupplierLinkFilters = { status: query.status ?? 'pending' }
    const candidates = await this.service.candidates()

    return inertia.render('admin/supplier_links/index', {
      suppliers: await this.service.list({
        ...filters,
        page: query.page ?? 1,
        perPage: PER_PAGE,
        locale: i18n.locale,
      }),
      organizationOptions: candidates.map(({ id, name }) => ({ id, name })),
      filters,
    })
  }

  async link(ctx: HttpContext) {
    const { bouncer, request, response, params, session, i18n } = ctx
    await bouncer.authorize('hasPlatformPermission', 'organizations.manage')

    const { organizationId } = await request.validateUsing(supplierLinkValidator)
    try {
      await this.service.link({
        supplierId: Number(params.id),
        organizationId,
        context: adminActionContext(ctx),
      })
    } catch (error) {
      return this.refuse(ctx, error)
    }

    session.flash('success', i18n.t('admin.supplierLinks.linked'))
    return response.redirect().back()
  }

  async unlink(ctx: HttpContext) {
    const { bouncer, response, params, session, i18n } = ctx
    await bouncer.authorize('hasPlatformPermission', 'organizations.manage')

    try {
      await this.service.unlink({ supplierId: Number(params.id), context: adminActionContext(ctx) })
    } catch (error) {
      return this.refuse(ctx, error)
    }

    session.flash('success', i18n.t('admin.supplierLinks.unlinked'))
    return response.redirect().back()
  }

  /** Refus métier : message flash et retour à l'écran ; toute autre erreur remonte. */
  private refuse({ response, session, i18n }: HttpContext, error: unknown) {
    const key = linkErrorKey(error)
    if (!key) throw error
    session.flash('error', i18n.t(key))
    return response.redirect().back()
  }
}
