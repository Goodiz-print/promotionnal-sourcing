import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import AdminAuditService from '#services/admin_audit_service'
import { AdminOrganizationNotFoundException } from '#exceptions/admin_errors'
import type { DatabaseQueryBuilderContract } from '@adonisjs/lucid/types/querybuilder'
import type { AdminActionContext } from '#shared/types/admin_audit'
import type {
  AdminConsentFilters,
  AdminConsentOverview,
  AdminConsentRow,
} from '#shared/types/admin_consent'
import { CURRENT_LEGAL_VERSION, type LegalConsentKind } from '#shared/types/legal'
import type { Paginated } from '#shared/types/pagination'

interface ListOptions extends AdminConsentFilters {
  page: number
  perPage: number
}

type ConsentDbRow = {
  id: number
  kind: LegalConsentKind
  version: string
  accepted_at: Date | string
  revoked_at: Date | string | null
  ip_address: string | null
  organization_id: number
  organization_name: string
  user_id: number | null
  user_email: string | null
}

const iso = (value: Date | string): string => new Date(value).toISOString()

/** Échappe les jokers `LIKE` : le terme saisi est cherché tel quel. */
const contains = (term: string) => `%${term.replace(/[\\%_]/g, '\\$&')}%`

/**
 * Journal des consentements légaux vu par la plateforme (#168). Ce sont des
 * preuves juridiques (version signée, date, IP) : en lecture seule, jamais de
 * modification. L'export d'une organisation écrit une entrée d'audit.
 */
@inject()
export default class AdminConsentService {
  constructor(private audit: AdminAuditService) {}

  async list(options: ListOptions): Promise<Paginated<AdminConsentRow>> {
    const { page, perPage, organization, user, kind, version, outdated } = options

    const query = this.baseQuery()
    if (organization) query.whereRaw('o.name ILIKE ?', [contains(organization)])
    if (user) query.whereRaw('u.email ILIKE ?', [contains(user)])
    if (kind) query.where('lc.kind', kind)
    if (version) query.where('lc.version', version)
    if (outdated) this.onlyOutdated(query)

    const paginator = await query
      .orderBy('lc.accepted_at', 'desc')
      .orderBy('lc.id', 'desc')
      .paginate(page, perPage)

    const { data, meta } = paginator.toJSON()
    return {
      data: data.map((row: ConsentDbRow) => this.present(row)),
      meta: {
        total: meta.total,
        perPage: meta.perPage,
        currentPage: meta.currentPage,
        lastPage: meta.lastPage,
      },
    }
  }

  async overview(): Promise<AdminConsentOverview> {
    const query = db.from('legal_consents as lc')
    this.onlyOutdated(query)
    const [{ total }] = await query.count('* as total')
    return { currentVersion: CURRENT_LEGAL_VERSION, outdatedCount: Number(total) }
  }

  /**
   * CSV de preuve (séparateur `;`, ouvrable dans Excel FR) de tous les
   * consentements d'une organisation, le plus ancien d'abord. La lecture et
   * l'entrée d'audit `consent.exported` partagent la même transaction.
   */
  async exportCsv(
    organizationId: number,
    header: string[],
    context: AdminActionContext
  ): Promise<{ filename: string; csv: string }> {
    return db.transaction(async (trx) => {
      const organization = await trx
        .from('organizations')
        .where('id', organizationId)
        .select('id', 'name')
        .first()
      if (!organization) throw new AdminOrganizationNotFoundException()

      const rows: ConsentDbRow[] = await this.baseQuery(trx)
        .where('lc.organization_id', organizationId)
        .orderBy('lc.accepted_at', 'asc')
        .orderBy('lc.id', 'asc')

      await this.audit.record(
        {
          action: 'consent.exported',
          targetType: 'organization',
          targetId: organizationId,
          changes: { after: { rows: rows.length } },
        },
        { ...context, client: trx }
      )

      const lines = [
        header,
        ...rows.map((row) => [
          row.id,
          row.kind,
          row.version,
          iso(row.accepted_at),
          row.revoked_at ? iso(row.revoked_at) : '',
          row.ip_address ?? '',
          row.user_email ?? '',
        ]),
      ]
      return {
        filename: `consentements-${organizationId}.csv`,
        csv: `\uFEFF${lines.map((line) => line.map(csvCell).join(';')).join('\r\n')}\r\n`,
      }
    })
  }

  private baseQuery(client = db.connection()) {
    return client
      .from('legal_consents as lc')
      .join('organizations as o', 'o.id', 'lc.organization_id')
      .leftJoin('users as u', 'u.id', 'lc.user_id')
      .select(
        'lc.id',
        'lc.kind',
        'lc.version',
        'lc.accepted_at',
        'lc.revoked_at',
        'lc.ip_address',
        'lc.organization_id',
        'o.name as organization_name',
        'lc.user_id',
        'u.email as user_email'
      )
  }

  /** Consentement actif (non retiré) signé sur une version antérieure à la version courante. */
  private onlyOutdated(query: DatabaseQueryBuilderContract): void {
    // Versions = dates ISO : la comparaison lexicographique suit l'ordre chronologique.
    query.whereNull('lc.revoked_at').where('lc.version', '<', CURRENT_LEGAL_VERSION)
  }

  private present(row: ConsentDbRow): AdminConsentRow {
    return {
      id: row.id,
      kind: row.kind,
      version: row.version,
      acceptedAt: iso(row.accepted_at),
      revokedAt: row.revoked_at ? iso(row.revoked_at) : null,
      ipAddress: row.ip_address,
      organization: { id: row.organization_id, name: row.organization_name },
      user: row.user_id && row.user_email ? { id: row.user_id, email: row.user_email } : null,
      outdated: !row.revoked_at && row.version < CURRENT_LEGAL_VERSION,
    }
  }
}

/** Cellule CSV entre guillemets ; une formule potentielle (`=`, `+`, `-`, `@`) est neutralisée. */
function csvCell(value: string | number): string {
  const text = /^[=+\-@\t\r]/.test(String(value)) ? `'${value}` : String(value)
  return `"${text.replace(/"/g, '""')}"`
}
