import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import AdminAuditService from '#services/admin_audit_service'
import { AdminMessagingNotFoundException } from '#exceptions/admin_trade_errors'
import type { AdminActionContext } from '#shared/types/admin_audit'
import type {
  AdminConversationDetail,
  AdminConversationFilters,
  AdminConversationRow,
  AdminMessageReport,
  AdminMessagingListOptions,
  AdminReportFilters,
  AdminReportRow,
} from '#shared/types/admin_messaging'
import type {
  MessageReportReason,
  MessageReportResolution,
  MessageReportStatus,
} from '#shared/types/conversation'
import type { Paginated } from '#shared/types/pagination'

/** Ligne SQL d'un fil (alias de `conversationQuery`). */
type ConversationDbRow = {
  id: number
  subject: string | null
  rfq_id: number | null
  blocked_at: Date | string | null
  created_at: Date | string
  buyer_id: number
  buyer_name: string
  supplier_id: number
  supplier_name: string
  messages_count: string | number
  open_reports_count: string | number
  last_message_at: Date | string | null
}

const iso = (value: Date | string | null | undefined): string | null =>
  value ? new Date(value).toISOString() : null

/** Échappe les jokers `LIKE` : le terme saisi est cherché tel quel. */
const contains = (term: string) => `%${term.replace(/[\\%_]/g, '\\$&')}%`

/** Longueur de l'extrait du message affiché dans la file de signalements. */
const EXCERPT_LENGTH = 160

/**
 * Lecture de la messagerie pour la modération (#167). Les messages sont des
 * données privées : **consulter un fil écrit une entrée d'audit** (dans la
 * même transaction que la lecture), la liste des fils et la file de
 * signalements, elles, ne montrent aucun contenu au-delà d'un extrait du
 * message signalé.
 */
@inject()
export default class AdminMessagingService {
  constructor(private audit: AdminAuditService) {}

  async listConversations(
    options: AdminMessagingListOptions<AdminConversationFilters>
  ): Promise<Paginated<AdminConversationRow>> {
    const { page, perPage, buyer, supplier, withOpenReports, blocked } = options

    const query = this.conversationQuery(db.connection())
    if (buyer) query.whereRaw('b.name ILIKE ?', [contains(buyer)])
    if (supplier) query.whereRaw('s.name ILIKE ?', [contains(supplier)])
    if (blocked) query.whereNotNull('c.blocked_at')
    if (withOpenReports) {
      query.whereExists((open) => {
        open
          .from('message_reports as mr')
          .join('messages as m', 'm.id', 'mr.message_id')
          .whereColumn('m.conversation_id', 'c.id')
          .where('mr.status', 'open')
      })
    }

    const paginator = await query.orderBy('c.id', 'desc').paginate(page, perPage)

    const { data, meta } = paginator.toJSON()
    return {
      data: data.map((row: ConversationDbRow) => this.presentConversation(row)),
      meta: {
        total: meta.total,
        perPage: meta.perPage,
        currentPage: meta.currentPage,
        lastPage: meta.lastPage,
      },
    }
  }

  async listReports(
    options: AdminMessagingListOptions<AdminReportFilters>
  ): Promise<Paginated<AdminReportRow>> {
    const { page, perPage, status } = options

    const paginator = await db
      .from('message_reports as mr')
      .join('messages as m', 'm.id', 'mr.message_id')
      .join('conversations as c', 'c.id', 'm.conversation_id')
      .join('organizations as b', 'b.id', 'c.buyer_organization_id')
      .join('organizations as s', 's.id', 'c.supplier_organization_id')
      .leftJoin('users as u', 'u.id', 'mr.reporter_user_id')
      .where('mr.status', status)
      .select('mr.id', 'mr.status', 'mr.resolution', 'mr.reason', 'mr.details', 'mr.created_at')
      .select('mr.message_id', 'm.body', 'm.hidden_at', 'u.email as reporter_email')
      .select('c.id as conversation_id', 'c.subject as conversation_subject')
      .select('b.name as buyer_name', 's.name as supplier_name')
      // Les plus anciens d'abord : une file se vide dans l'ordre d'arrivée.
      .orderBy('mr.created_at', 'asc')
      .orderBy('mr.id', 'asc')
      .paginate(page, perPage)

    const { data, meta } = paginator.toJSON()
    return {
      data: data.map((row): AdminReportRow => ({
        id: row.id,
        status: row.status as MessageReportStatus,
        resolution: row.resolution as MessageReportResolution | null,
        reason: row.reason as MessageReportReason,
        details: row.details,
        reporterEmail: row.reporter_email,
        createdAt: iso(row.created_at)!,
        messageId: row.message_id,
        // Un message déjà masqué n'est plus recopié dans la file.
        messageExcerpt: row.hidden_at ? '' : String(row.body).slice(0, EXCERPT_LENGTH),
        conversationId: row.conversation_id,
        conversationSubject: row.conversation_subject,
        buyerName: row.buyer_name,
        supplierName: row.supplier_name,
      })),
      meta: {
        total: meta.total,
        perPage: meta.perPage,
        currentPage: meta.currentPage,
        lastPage: meta.lastPage,
      },
    }
  }

  /**
   * Fil complet avec ses messages et leurs signalements. L'accès est tracé
   * (`conversation.viewed`) : sans entrée d'audit, la lecture n'a pas lieu.
   */
  async detail(
    conversationId: number,
    context: AdminActionContext
  ): Promise<AdminConversationDetail> {
    return db.transaction(async (trx) => {
      const row: (ConversationDbRow & { blocked_reason: string | null }) | null =
        await this.conversationQuery(trx)
          .where('c.id', conversationId)
          .select('c.blocked_reason')
          .first()
      if (!row) throw new AdminMessagingNotFoundException()

      const [messages, reports] = await Promise.all([
        trx
          .from('messages as m')
          .leftJoin('users as u', 'u.id', 'm.author_user_id')
          .where('m.conversation_id', conversationId)
          .select('m.id', 'm.body', 'm.created_at', 'm.hidden_at', 'u.email as author_email')
          .select(
            trx.raw(
              `(SELECT ou.organization_id FROM organization_users ou
                WHERE ou.user_id = m.author_user_id
                  AND ou.organization_id IN (?, ?) LIMIT 1) AS author_organization_id`,
              [row.buyer_id, row.supplier_id]
            )
          )
          .orderBy('m.created_at', 'asc')
          .orderBy('m.id', 'asc'),
        trx
          .from('message_reports as mr')
          .join('messages as m', 'm.id', 'mr.message_id')
          .leftJoin('users as u', 'u.id', 'mr.reporter_user_id')
          .where('m.conversation_id', conversationId)
          .select('mr.id', 'mr.message_id', 'mr.status', 'mr.resolution', 'mr.reason')
          .select('mr.details', 'mr.created_at', 'u.email as reporter_email')
          .orderBy('mr.id', 'asc'),
      ])

      await this.audit.record(
        { action: 'conversation.viewed', targetType: 'conversation', targetId: conversationId },
        { ...context, client: trx }
      )

      const reportsByMessage = new Map<number, AdminMessageReport[]>()
      for (const report of reports) {
        const list = reportsByMessage.get(report.message_id) ?? []
        list.push({
          id: report.id,
          status: report.status as MessageReportStatus,
          resolution: report.resolution as MessageReportResolution | null,
          reason: report.reason as MessageReportReason,
          details: report.details,
          reporterEmail: report.reporter_email,
          createdAt: iso(report.created_at)!,
        })
        reportsByMessage.set(report.message_id, list)
      }

      return {
        conversation: this.presentConversation(row),
        blockedReason: row.blocked_reason,
        messages: messages.map((message) => ({
          id: message.id,
          body: message.body,
          authorEmail: message.author_email,
          authorOrganizationId: message.author_organization_id,
          createdAt: iso(message.created_at)!,
          hiddenAt: iso(message.hidden_at),
          reports: reportsByMessage.get(message.id) ?? [],
        })),
      }
    })
  }

  private conversationQuery(client: QueryClientContract) {
    return client
      .from('conversations as c')
      .join('organizations as b', 'b.id', 'c.buyer_organization_id')
      .join('organizations as s', 's.id', 'c.supplier_organization_id')
      .select('c.id', 'c.subject', 'c.rfq_id', 'c.blocked_at', 'c.created_at')
      .select('b.id as buyer_id', 'b.name as buyer_name', 's.id as supplier_id')
      .select('s.name as supplier_name')
      .select(
        client.raw(
          '(SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS messages_count'
        ),
        client.raw(
          `(SELECT COUNT(*) FROM message_reports mr JOIN messages m ON m.id = mr.message_id
            WHERE m.conversation_id = c.id AND mr.status = 'open') AS open_reports_count`
        ),
        client.raw(
          '(SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id) AS last_message_at'
        )
      )
  }

  private presentConversation(row: ConversationDbRow): AdminConversationRow {
    return {
      id: row.id,
      subject: row.subject,
      rfqId: row.rfq_id,
      buyer: { id: row.buyer_id, name: row.buyer_name },
      supplier: { id: row.supplier_id, name: row.supplier_name },
      messagesCount: Number(row.messages_count),
      openReportsCount: Number(row.open_reports_count),
      blockedAt: iso(row.blocked_at),
      lastMessageAt: iso(row.last_message_at),
      createdAt: iso(row.created_at)!,
    }
  }
}
