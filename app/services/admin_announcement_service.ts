import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import SendAnnouncementJob from '#jobs/send_announcement_job'
import AdminAuditService from '#services/admin_audit_service'
import AnnouncementDispatcher from '#services/announcement_dispatcher'
import { AdminOrganizationNotFoundException } from '#exceptions/admin_errors'
import { pickAnnouncementContent } from '#shared/helpers/announcement'
import type { AdminActionContext } from '#shared/types/admin_audit'
import type {
  AdminAnnouncementRow,
  AnnouncementAudience,
  AnnouncementStatus,
  AnnouncementTranslations,
  CreateAnnouncementInput,
} from '#shared/types/announcement'
import type { Locale } from '#shared/types/i18n'
import type { Paginated } from '#shared/types/pagination'

type AnnouncementDbRow = {
  id: number
  audience: AnnouncementAudience
  organization_id: number | null
  organization_name: string | null
  send_in_app: boolean
  send_email: boolean
  translations: AnnouncementTranslations | string
  status: AnnouncementStatus
  recipients_count: number
  read_count: string | number
  creator_email: string | null
  created_at: Date | string
  sent_at: Date | string | null
}

const iso = (value: Date | string): string => new Date(value).toISOString()

/**
 * Annonces plateforme vues du back-office (#169) : création (tracée dans l'audit
 * dans la même transaction), historique avec taux de lecture. La distribution
 * elle-même est asynchrone (`SendAnnouncementJob`).
 */
@inject()
export default class AdminAnnouncementService {
  constructor(
    private audit: AdminAuditService,
    private dispatcher: AnnouncementDispatcher
  ) {}

  async list(options: {
    page: number
    perPage: number
    locale: Locale
  }): Promise<Paginated<AdminAnnouncementRow>> {
    const paginator = await db
      .from('announcements as a')
      .leftJoin('organizations as o', 'o.id', 'a.organization_id')
      .leftJoin('users as u', 'u.id', 'a.created_by_user_id')
      .select(
        'a.id',
        'a.audience',
        'a.organization_id',
        'o.name as organization_name',
        'a.send_in_app',
        'a.send_email',
        'a.translations',
        'a.status',
        'a.recipients_count',
        'u.email as creator_email',
        'a.created_at',
        'a.sent_at',
        db.raw(
          '(select count(*) from notifications n where n.announcement_id = a.id and n.read_at is not null) as read_count'
        )
      )
      .orderBy('a.created_at', 'desc')
      .orderBy('a.id', 'desc')
      .paginate(options.page, options.perPage)

    const { data, meta } = paginator.toJSON()
    return {
      data: data.map((row: AnnouncementDbRow) => this.present(row, options.locale)),
      meta: {
        total: meta.total,
        perPage: meta.perPage,
        currentPage: meta.currentPage,
        lastPage: meta.lastPage,
      },
    }
  }

  /** Utilisateurs actifs de chaque segment général, pour confirmer l'envoi en connaissance de cause. */
  async audienceSizes(): Promise<Record<Exclude<AnnouncementAudience, 'organization'>, number>> {
    const [all, buyers, suppliers, agencies] = await Promise.all([
      this.dispatcher.countAudience('all', null),
      this.dispatcher.countAudience('buyers', null),
      this.dispatcher.countAudience('suppliers', null),
      this.dispatcher.countAudience('agencies', null),
    ])
    return { all, buyers, suppliers, agencies }
  }

  /**
   * Enregistre l'annonce et l'entrée d'audit dans une transaction, puis met la
   * distribution en queue. Renvoie l'identifiant de l'annonce.
   */
  async create(input: CreateAnnouncementInput, context: AdminActionContext): Promise<number> {
    const announcementId = await db.transaction(async (trx) => {
      if (input.audience === 'organization') {
        const organization = await trx
          .from('organizations')
          .where('id', input.organizationId ?? 0)
          .select('id')
          .first()
        if (!organization) throw new AdminOrganizationNotFoundException()
      }

      const now = new Date()
      const [{ id }] = await trx
        .table('announcements')
        .insert({
          created_by_user_id: context.actor?.id ?? null,
          audience: input.audience,
          organization_id: input.audience === 'organization' ? input.organizationId : null,
          send_in_app: input.sendInApp,
          send_email: input.sendEmail,
          translations: JSON.stringify(input.translations),
          status: 'queued',
          created_at: now,
          updated_at: now,
        })
        .returning('id')

      await this.audit.record(
        {
          action: 'announcement.created',
          targetType: 'announcement',
          targetId: id,
          changes: {
            after: {
              audience: input.audience,
              organizationId: input.audience === 'organization' ? input.organizationId : null,
              sendInApp: input.sendInApp,
              sendEmail: input.sendEmail,
              locales: Object.keys(input.translations).join(','),
            },
          },
        },
        { ...context, client: trx }
      )
      return id as number
    })

    await SendAnnouncementJob.dispatch({ announcementId })
    return announcementId
  }

  private present(row: AnnouncementDbRow, locale: Locale): AdminAnnouncementRow {
    const translations =
      typeof row.translations === 'string'
        ? (JSON.parse(row.translations) as AnnouncementTranslations)
        : row.translations

    return {
      id: row.id,
      title: pickAnnouncementContent(translations, locale).title,
      audience: row.audience,
      organization:
        row.organization_id !== null && row.organization_name !== null
          ? { id: row.organization_id, name: row.organization_name }
          : null,
      sendInApp: row.send_in_app,
      sendEmail: row.send_email,
      status: row.status,
      recipients: Number(row.recipients_count),
      read: Number(row.read_count),
      createdBy: row.creator_email,
      createdAt: iso(row.created_at),
      sentAt: row.sent_at ? iso(row.sent_at) : null,
    }
  }
}
