import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import SendAnnouncementJob from '#jobs/send_announcement_job'
import AdminAuditService from '#services/admin_audit_service'
import AnnouncementDispatcher from '#services/announcement_dispatcher'
import { AdminOrganizationNotFoundException } from '#exceptions/admin_errors'
import {
  parseAnnouncementTranslations,
  pickAnnouncementContent,
} from '#shared/helpers/announcement'
import type { AdminActionContext } from '#shared/types/admin_audit'
import {
  ANNOUNCEMENT_DUPLICATE_WINDOW_SECONDS,
  ANNOUNCEMENT_STALE_QUEUED_MINUTES,
  type AdminAnnouncementDbRow,
  type AdminAnnouncementRow,
  type AnnouncementAudience,
  type CreateAnnouncementInput,
} from '#shared/types/announcement'
import type { Locale } from '#shared/types/i18n'
import type { Paginated } from '#shared/types/pagination'

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
        'a.error',
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
      data: data.map((row: AdminAnnouncementDbRow) => this.present(row, options.locale)),
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
    const { id: announcementId, created } = await db.transaction(async (trx) => {
      if (input.audience === 'organization') {
        const organization = await trx
          .from('organizations')
          .where('id', input.organizationId ?? 0)
          .select('id')
          .first()
        if (!organization) throw new AdminOrganizationNotFoundException()
      }

      // Double clic ou POST rejoué : le même envoi du même auteur n'est créé qu'une fois.
      const duplicate = await trx
        .from('announcements')
        .where('created_by_user_id', context.actor?.id ?? 0)
        .where('audience', input.audience)
        .where('send_in_app', input.sendInApp)
        .where('send_email', input.sendEmail)
        .whereRaw('translations = ?::jsonb', [JSON.stringify(input.translations)])
        .whereRaw(`created_at > now() - make_interval(secs => ?)`, [
          ANNOUNCEMENT_DUPLICATE_WINDOW_SECONDS,
        ])
        .if(input.audience === 'organization', (q) =>
          q.where('organization_id', input.organizationId ?? 0)
        )
        .select('id')
        .first()
      if (duplicate) return { id: duplicate.id as number, created: false }

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
      return { id: id as number, created: true }
    })

    if (created) await this.enqueue(announcementId)
    return announcementId
  }

  /**
   * Relance une annonce échouée, ou restée en attente (mise en queue perdue).
   * Sans effet sur une annonce déjà envoyée ou en cours. Renvoie `false` si elle
   * n'est pas relançable.
   */
  async retry(announcementId: number, context: AdminActionContext): Promise<boolean> {
    const staleBefore = new Date(Date.now() - ANNOUNCEMENT_STALE_QUEUED_MINUTES * 60_000)
    const retried = await db.transaction(async (trx) => {
      const updated = await trx
        .from('announcements')
        .where('id', announcementId)
        .where((q) =>
          q
            .where('status', 'failed')
            .orWhere((stale) =>
              stale.where('status', 'queued').where('created_at', '<', staleBefore)
            )
        )
        .update({ status: 'queued', error: null, updated_at: new Date() })
      if (!updated) return false

      await this.audit.record(
        { action: 'announcement.retried', targetType: 'announcement', targetId: announcementId },
        { ...context, client: trx }
      )
      return true
    })

    if (retried) await this.enqueue(announcementId)
    return retried
  }

  /** Met la distribution en queue ; si la queue est indisponible, l'échec reste visible et relançable. */
  private async enqueue(announcementId: number): Promise<void> {
    try {
      await SendAnnouncementJob.dispatch({ announcementId })
    } catch (error) {
      await this.dispatcher.markFailed(announcementId, error as Error)
      throw error
    }
  }

  private present(row: AdminAnnouncementDbRow, locale: Locale): AdminAnnouncementRow {
    const translations = parseAnnouncementTranslations(row.translations)
    const createdAt = new Date(row.created_at)
    const staleBefore = Date.now() - ANNOUNCEMENT_STALE_QUEUED_MINUTES * 60_000

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
      error: row.error,
      retryable:
        row.status === 'failed' || (row.status === 'queued' && createdAt.getTime() < staleBefore),
      createdBy: row.creator_email,
      createdAt: iso(row.created_at),
      sentAt: row.sent_at ? iso(row.sent_at) : null,
    }
  }
}
