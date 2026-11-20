import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AdminAuditService from '#services/admin_audit_service'
import SearchSyncService from '#services/search_sync_service'
import Organization from '#models/organization'
import Supplier from '#models/supplier'
import {
  SupplierAlreadyLinkedException,
  SupplierLinkNotFoundException,
  SupplierLinkOrganizationInvalidException,
  SupplierNotLinkedException,
} from '#exceptions/supplier_link_errors'
import { suggestOrganization } from '#shared/helpers/supplier_link'
import { resolveTranslation } from '#shared/helpers/translations'
import type { Paginated } from '#shared/types/pagination'
import type {
  AdminSupplierLinkItem,
  SupplierLinkCandidate,
  SupplierLinkListOptions,
  SupplierLinkMemberRow,
  SupplierLinkOptions,
  SupplierLinkSuggestion,
  SupplierUnlinkOptions,
} from '#shared/types/supplier_link'

/**
 * Rattachement des fiches fournisseur importées à l'organisation du
 * fournisseur (#231). Le rattachement, validé par un admin, vaut accord du
 * fournisseur pour publier son catalogue : sa date et son auteur sont gardés
 * sur la fiche (`linked_at`, `linked_by_user_id`) et l'action est tracée dans
 * le journal d'audit, dans la même transaction. Une fiche n'a qu'une seule
 * organisation : pour en changer, la détacher d'abord.
 *
 * Rattachement comme détachement changent l'organisation de tout le catalogue
 * de la fiche : ses produits sont réindexés par la queue, après le commit.
 */
@inject()
export default class AdminSupplierLinkService {
  constructor(
    private audit: AdminAuditService,
    private search: SearchSyncService
  ) {}

  async list(options: SupplierLinkListOptions): Promise<Paginated<AdminSupplierLinkItem>> {
    const { page, perPage, status, locale } = options
    const paginator = await Supplier.query()
      .if(status === 'pending', (query) => query.whereNull('organizationId'))
      .if(status === 'linked', (query) => query.whereNotNull('organizationId'))
      .preload('translations')
      .preload('organization', (query) => query.select('id', 'name'))
      .preload('linkedBy', (query) => query.select('id', 'email'))
      .withCount('products')
      .orderByRaw('linked_at DESC NULLS LAST')
      .orderBy('id', 'asc')
      .paginate(page, perPage)

    const suppliers = paginator.all()
    const candidates = status === 'pending' && suppliers.length > 0 ? await this.candidates() : []
    const { total, perPage: size, currentPage, lastPage } = paginator.getMeta()
    return {
      data: suppliers.map((supplier) => this.present(supplier, candidates, locale)),
      meta: { total, perPage: size, currentPage, lastPage },
    }
  }

  /**
   * Organisations auxquelles une fiche peut être rattachée : fournisseurs non
   * archivés, avec les emails de leurs membres (pour la suggestion).
   */
  async candidates(): Promise<SupplierLinkCandidate[]> {
    const organizations = await Organization.query()
      .where('organizationType', 'supplier')
      .whereNull('archivedAt')
      .select('id', 'name', 'email', 'website')
      .orderBy('name', 'asc')
      .orderBy('id', 'asc')
    const members = await this.memberEmails(organizations.map((organization) => organization.id))

    return organizations.map((organization) => ({
      id: organization.id,
      name: organization.name,
      email: organization.email,
      website: organization.website,
      memberEmails: members.get(organization.id) ?? [],
    }))
  }

  async link({ supplierId, organizationId, context }: SupplierLinkOptions): Promise<Supplier> {
    const supplier = await db.transaction(async (trx) => {
      const locked = await this.lockOrFail(supplierId, trx)
      if (locked.organizationId !== null) throw new SupplierAlreadyLinkedException()
      await this.assertLinkable(organizationId, trx)

      locked.useTransaction(trx)
      locked.merge({
        organizationId,
        linkedAt: DateTime.now(),
        linkedByUserId: context.actor?.id ?? null,
      })
      await locked.save()

      await this.audit.record(
        {
          action: 'supplier.linked',
          targetType: 'supplier',
          targetId: locked.id,
          changes: { before: { organizationId: null }, after: { organizationId } },
        },
        { ...context, client: trx }
      )
      return locked
    })

    await this.search.queueSupplier(supplier.id)
    return supplier
  }

  async unlink({ supplierId, context }: SupplierUnlinkOptions): Promise<Supplier> {
    const supplier = await db.transaction(async (trx) => {
      const locked = await this.lockOrFail(supplierId, trx)
      const previous = locked.organizationId
      if (previous === null) throw new SupplierNotLinkedException()

      locked.useTransaction(trx)
      locked.merge({ organizationId: null, linkedAt: null, linkedByUserId: null })
      await locked.save()

      await this.audit.record(
        {
          action: 'supplier.unlinked',
          targetType: 'supplier',
          targetId: locked.id,
          changes: { before: { organizationId: previous }, after: { organizationId: null } },
        },
        { ...context, client: trx }
      )
      return locked
    })

    await this.search.queueSupplier(supplier.id)
    return supplier
  }

  private async lockOrFail(supplierId: number, trx: TransactionClientContract) {
    const supplier = await Supplier.query({ client: trx })
      .where('id', supplierId)
      .forUpdate()
      .first()
    if (!supplier) throw new SupplierLinkNotFoundException()
    return supplier
  }

  /** L'organisation cible doit exister, être un fournisseur et ne pas être archivée. */
  private async assertLinkable(organizationId: number, trx: TransactionClientContract) {
    const organization = await Organization.query({ client: trx })
      .where('id', organizationId)
      .where('organizationType', 'supplier')
      .whereNull('archivedAt')
      .select('id')
      .first()
    if (!organization) throw new SupplierLinkOrganizationInvalidException()
  }

  private async memberEmails(organizationIds: number[]): Promise<Map<number, string[]>> {
    if (organizationIds.length === 0) return new Map()
    const rows: SupplierLinkMemberRow[] = await db
      .from('organization_users')
      .join('users', 'users.id', 'organization_users.user_id')
      .whereIn('organization_users.organization_id', organizationIds)
      .select('organization_users.organization_id', 'users.email')

    const grouped = Map.groupBy(rows, (row) => row.organization_id)
    return new Map([...grouped].map(([id, members]) => [id, members.map((member) => member.email)]))
  }

  private present(
    supplier: Supplier,
    candidates: SupplierLinkCandidate[],
    locale: string
  ): AdminSupplierLinkItem {
    return {
      id: supplier.id,
      slug: supplier.slug,
      name: resolveTranslation(supplier.translations, locale)?.name ?? supplier.slug,
      country: supplier.country,
      email: supplier.email,
      website: supplier.website,
      productsCount: Number(supplier.$extras.products_count ?? 0),
      ...this.linkState(supplier),
      suggestion: supplier.organization ? null : this.suggestion(supplier, candidates),
    }
  }

  /** Organisation rattachée et accord (date, auteur) d'une fiche. */
  private linkState(
    supplier: Supplier
  ): Pick<AdminSupplierLinkItem, 'organization' | 'linkedAt' | 'linkedByEmail'> {
    const organization = supplier.organization
    return {
      organization: organization ? { id: organization.id, name: organization.name } : null,
      linkedAt: supplier.linkedAt?.toISO() ?? null,
      linkedByEmail: supplier.linkedBy?.email ?? null,
    }
  }

  private suggestion(
    supplier: Supplier,
    candidates: SupplierLinkCandidate[]
  ): SupplierLinkSuggestion | null {
    const found = suggestOrganization(supplier, candidates)
    if (!found) return null
    return {
      organizationId: found.candidate.id,
      organizationName: found.candidate.name,
      match: found.match,
    }
  }
}
