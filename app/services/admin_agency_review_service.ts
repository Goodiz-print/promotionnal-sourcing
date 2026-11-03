import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AdminAuditService from '#services/admin_audit_service'
import AgencyReviewNotificationService from '#services/agency_review_notification_service'
import OrganizationService from '#services/organization_service'
import AgencyReviewDecisionRecord from '#models/agency_review_decision'
import Organization from '#models/organization'
import OrganizationUser from '#models/organization_user'
import {
  AgencyReviewClosedException,
  AgencyReviewNotFoundException,
} from '#exceptions/agency_review_errors'
import type {
  AdminAgencyReviewDetail,
  AdminAgencyReviewFilters,
  AdminAgencyReviewHistoryItem,
  AdminAgencyReviewItem,
  AgencyReviewDecideOptions,
  AgencyReviewListOptions,
  AgencyReviewQueueRow,
  AgencyReviewStatus,
} from '#shared/types/agency_review'
import type { PaginationMeta } from '#shared/types/pagination'

/** Dernière décision de l'agence (`o` = alias de `organizations`) ; NULL si aucune. */
const LATEST_DECISION = `(
  SELECT d.decision FROM agency_review_decisions d
  WHERE d.organization_id = o.id
  ORDER BY d.decided_at DESC, d.id DESC LIMIT 1
)`

/**
 * File de revue des inscriptions agence (#162). Une agence est « à revoir » tant
 * que `organizations.review_reasons` n'est pas vide et qu'elle n'est pas
 * archivée ; chaque décision est ajoutée à `agency_review_decisions` et tracée
 * dans le journal d'audit, dans la même transaction.
 *
 * - `approved` : vide `review_reasons`, l'agence sort de la file ;
 * - `rejected` : archive l'organisation (elle sort du service, rien n'est supprimé) ;
 * - `info_requested` : l'agence reste dans la file, un message lui est envoyé.
 */
@inject()
export default class AdminAgencyReviewService {
  constructor(
    private audit: AdminAuditService,
    private organizations: OrganizationService,
    private notifications: AgencyReviewNotificationService
  ) {}

  async list(options: AgencyReviewListOptions) {
    const { page, perPage, status } = options
    const query = this.queue(status)

    const total = await query.clone().count('* as total').first()
    const count = Number(total?.total ?? 0)
    const rows = (await query
      .select(
        'o.id',
        'o.name',
        'o.country',
        'o.email',
        'o.website',
        'o.review_reasons',
        'o.vat_verified_at',
        'o.domain_verified_at',
        'o.created_at',
        db.raw(`${LATEST_DECISION} AS decision`)
      )
      .orderBy('o.created_at', 'asc')
      .orderBy('o.id', 'asc')
      .limit(perPage)
      .offset((page - 1) * perPage)) as AgencyReviewQueueRow[]

    const meta: PaginationMeta = {
      total: count,
      perPage,
      currentPage: page,
      lastPage: Math.max(1, Math.ceil(count / perPage)),
    }
    return { data: rows.map((row) => this.present(row)), meta }
  }

  /** Agences encore à revoir : compteur du tableau de bord. */
  async openCount(): Promise<number> {
    const row = await this.queue('open').count('* as total').first()
    return Number(row?.total ?? 0)
  }

  async detail(organizationId: number): Promise<AdminAgencyReviewDetail> {
    const row = (await this.queue(null)
      .where('o.id', organizationId)
      .select(
        'o.id',
        'o.name',
        'o.country',
        'o.email',
        'o.website',
        'o.phone',
        'o.siret',
        'o.vat_number',
        'o.review_reasons',
        'o.vat_verified_at',
        'o.domain_verified_at',
        'o.created_at',
        'o.archived_at',
        'ap.activity',
        'ap.activity_other',
        db.raw(`${LATEST_DECISION} AS decision`)
      )
      .first()) as
      | (AgencyReviewQueueRow & {
          phone: string | null
          siret: string | null
          vat_number: string | null
          archived_at: Date | null
          activity: string
          activity_other: string | null
        })
      | undefined
    if (!row) throw new AgencyReviewNotFoundException()

    const [owners, records] = await Promise.all([
      OrganizationUser.query()
        .where('organizationId', organizationId)
        .whereHas('role', (role) => role.where('slug', 'owner'))
        .preload('user'),
      AgencyReviewDecisionRecord.query()
        .where('organizationId', organizationId)
        .orderBy('decidedAt', 'desc')
        .orderBy('id', 'desc')
        .preload('decidedBy'),
    ])

    const history: AdminAgencyReviewHistoryItem[] = records.map((record) => ({
      id: record.id,
      decision: record.decision,
      reason: record.reason,
      reasons: record.reviewReasons,
      decidedByEmail: record.decidedBy?.email ?? null,
      decidedAt: record.decidedAt.toISO()!,
    }))

    return {
      item: this.present(row),
      phone: row.phone,
      siret: row.siret,
      vatNumber: row.vat_number,
      activity: row.activity === 'other' ? (row.activity_other ?? row.activity) : row.activity,
      owners: owners.map(({ user }) => ({ email: user.email, fullName: user.fullName })),
      history,
      canDecide: !row.archived_at && row.review_reasons.length > 0,
    }
  }

  /**
   * Enregistre la décision, ses effets sur l'organisation (motifs levés, ou
   * archivage pour un rejet) et sa trace d'audit dans une seule transaction.
   * L'organisation est verrouillée (`FOR UPDATE`) puis son état relu : deux
   * décisions simultanées sont sérialisées, la seconde voit l'agence déjà traitée
   * (409). Le mail à l'agence et la réindexation partent après le commit.
   */
  async decide(options: AgencyReviewDecideOptions): Promise<AgencyReviewDecisionRecord> {
    const { organizationId, decision, reason, decidedBy, context } = options

    const { record, organization } = await db.transaction(async (trx) => {
      const locked = await Organization.query({ client: trx })
        .where('id', organizationId)
        .whereHas('agencyProfile', (profile) => profile.whereNotNull('id'))
        .forUpdate()
        .first()
      if (!locked) throw new AgencyReviewNotFoundException()
      if (locked.archivedAt || locked.reviewReasons.length === 0) {
        throw new AgencyReviewClosedException()
      }

      const reasons = [...locked.reviewReasons]
      const previous = await this.currentStatus(locked.id, trx)

      const created = await AgencyReviewDecisionRecord.create(
        {
          organizationId: locked.id,
          decision,
          reason,
          reviewReasons: reasons,
          decidedByUserId: decidedBy.id,
          decidedAt: DateTime.now(),
        },
        { client: trx }
      )

      if (decision === 'approved') {
        locked.reviewReasons = []
        await locked.save()
      } else if (decision === 'rejected') {
        await this.organizations.archiveWithin(locked, trx)
      }

      await this.audit.record(
        {
          action: `agency_review.${decision}`,
          targetType: 'organization',
          targetId: locked.id,
          changes: {
            before: { status: previous, review_reasons: reasons.join(',') },
            after: { status: decision, reason },
          },
        },
        { ...context, client: trx }
      )
      return { record: created, organization: locked }
    })

    if (decision === 'rejected') await this.organizations.notifyArchived(organization)
    await this.notifications.notifyDecision(organization, record)
    return record
  }

  private async currentStatus(
    organizationId: number,
    trx: TransactionClientContract
  ): Promise<AgencyReviewStatus> {
    const latest = await AgencyReviewDecisionRecord.query({ client: trx })
      .where('organizationId', organizationId)
      .orderBy('decidedAt', 'desc')
      .orderBy('id', 'desc')
      .first()
    return latest ? latest.decision : 'pending'
  }

  /**
   * Agences ayant un profil agence et, selon le filtre : encore à revoir (`open`),
   * ou dont la dernière décision est `approved` / `rejected`. `null` = toutes.
   */
  private queue(status: AdminAgencyReviewFilters['status'] | null) {
    const query = db
      .from('organizations as o')
      .join('agency_profiles as ap', 'ap.organization_id', 'o.id')

    if (status === 'open') {
      query.whereNull('o.archived_at').whereRaw('cardinality(o.review_reasons) > 0')
    } else if (status) {
      query.whereRaw(`${LATEST_DECISION} = ?`, [status])
    }
    return query
  }

  private present(row: AgencyReviewQueueRow): AdminAgencyReviewItem {
    return {
      id: row.id,
      name: row.name,
      country: row.country,
      email: row.email,
      website: row.website,
      reasons: row.review_reasons,
      vatVerifiedAt: row.vat_verified_at ? new Date(row.vat_verified_at).toISOString() : null,
      domainVerifiedAt: row.domain_verified_at
        ? new Date(row.domain_verified_at).toISOString()
        : null,
      status: row.decision ?? 'pending',
      submittedAt: new Date(row.created_at).toISOString(),
    }
  }
}
