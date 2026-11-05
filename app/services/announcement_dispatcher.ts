import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import SendMailJob from '#jobs/send_mail_job'
import { mailIdempotencyKey } from '#shared/helpers/mail'
import {
  parseAnnouncementTranslations,
  pickAnnouncementContent,
} from '#shared/helpers/announcement'
import {
  ANNOUNCEMENT_BATCH_SIZE,
  type AnnouncementAudience,
  type AnnouncementDeliveryRow,
  type AnnouncementRecipientRow,
  type AnnouncementTranslations,
} from '#shared/types/announcement'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '#shared/types/i18n'
import { MAIL_KINDS, type SendMailPayload } from '#shared/types/mail'

/** Mails mis en queue en parallèle : borne le nombre d'allers-retours simultanés vers la queue. */
const MAIL_DISPATCH_CONCURRENCY = 50

/**
 * Distribue une annonce (#169) : une notification in-app et/ou un mail par
 * destinataire, par lots. Appelé par `SendAnnouncementJob`, chargé au boot de la
 * queue : pas d'import de modèle Lucid, d'où l'accès par `db`.
 *
 * **Rejouable** : la contrainte unique `(announcement_id, user_id)` ignore les
 * notifications déjà créées, et la clé d'idempotence des mails (annonce + adresse)
 * évite le double envoi. Une reprise après échec peut donc relancer tout le segment.
 */
export default class AnnouncementDispatcher {
  /** Distribue l'annonce et renvoie le nombre d'utilisateurs ciblés. */
  async deliver(announcementId: number): Promise<number> {
    const announcement = await this.find(announcementId)
    if (!announcement || announcement.status === 'sent') return 0

    await db
      .from('announcements')
      .where('id', announcementId)
      .update({ status: 'sending', error: null, updated_at: new Date() })

    const translations = parseAnnouncementTranslations(announcement.translations)
    let total = 0
    let lastId = 0
    for (;;) {
      const batch = await this.nextBatch(announcement, lastId)
      if (batch.length === 0) break
      lastId = batch[batch.length - 1].id
      total += batch.length

      if (announcement.send_in_app)
        await this.createNotifications(announcement, batch, translations)
      if (announcement.send_email) await this.queueMails(announcement, batch, translations)

      // Compteur à jour à chaque lot : un échec en cours de route ne le laisse pas à zéro.
      await db
        .from('announcements')
        .where('id', announcementId)
        .update({ recipients_count: total, updated_at: new Date() })
    }

    await db.from('announcements').where('id', announcementId).update({
      status: 'sent',
      recipients_count: total,
      sent_at: DateTime.now().toJSDate(),
      updated_at: new Date(),
    })
    return total
  }

  /** Échec définitif du job : l'annonce reste consultable avec son motif. */
  async markFailed(announcementId: number, error: Error): Promise<void> {
    await db
      .from('announcements')
      .where('id', announcementId)
      .whereNot('status', 'sent')
      .update({ status: 'failed', error: error.message.slice(0, 1000), updated_at: new Date() })
  }

  /**
   * Nombre d'utilisateurs actifs que cible un segment — pour confirmer l'envoi
   * avant de le déclencher.
   */
  async countAudience(
    audience: AnnouncementAudience,
    organizationId: number | null
  ): Promise<number> {
    const row = await this.audienceQuery(audience, organizationId).count('* as total').first()
    return Number((row as { total: string | number } | null)?.total ?? 0)
  }

  private async find(announcementId: number): Promise<AnnouncementDeliveryRow | null> {
    const row = await db
      .from('announcements')
      .where('id', announcementId)
      .select(
        'id',
        'audience',
        'organization_id',
        'send_in_app',
        'send_email',
        'translations',
        'status'
      )
      .first()
    return (row as AnnouncementDeliveryRow | null) ?? null
  }

  /** Utilisateurs non suspendus du segment, par ordre d'identifiant (pagination par curseur). */
  private nextBatch(
    announcement: AnnouncementDeliveryRow,
    afterId: number
  ): Promise<AnnouncementRecipientRow[]> {
    return this.audienceQuery(announcement.audience, announcement.organization_id)
      .where('u.id', '>', afterId)
      .select('u.id', 'u.email', 'u.locale', 'u.email_verified_at')
      .orderBy('u.id', 'asc')
      .limit(ANNOUNCEMENT_BATCH_SIZE)
  }

  private audienceQuery(audience: AnnouncementAudience, organizationId: number | null) {
    const query = db.from('users as u').whereNull('u.suspended_at')
    if (audience === 'all') return query

    return query.whereExists((memberships) => {
      memberships
        .from('organization_users as ou')
        .join('organizations as o', 'o.id', 'ou.organization_id')
        .whereColumn('ou.user_id', 'u.id')
        .whereNull('o.archived_at')
        .select(db.raw('1'))

      if (audience === 'buyers') memberships.whereIn('o.organization_type', ['buyer', 'both'])
      else if (audience === 'suppliers') {
        memberships.whereIn('o.organization_type', ['supplier', 'both'])
      } else if (audience === 'agencies') {
        memberships.whereExists((agency) => {
          agency
            .from('agency_profiles as ap')
            .whereColumn('ap.organization_id', 'o.id')
            .select(db.raw('1'))
        })
      } else memberships.where('o.id', organizationId ?? 0)
    })
  }

  private contentFor(translations: AnnouncementTranslations, recipient: AnnouncementRecipientRow) {
    const locale = (SUPPORTED_LOCALES as readonly string[]).includes(recipient.locale)
      ? (recipient.locale as Locale)
      : DEFAULT_LOCALE
    return { locale, content: pickAnnouncementContent(translations, locale) }
  }

  private async createNotifications(
    announcement: AnnouncementDeliveryRow,
    batch: AnnouncementRecipientRow[],
    translations: AnnouncementTranslations
  ): Promise<void> {
    const now = new Date()
    await db
      .table('notifications')
      .insert(
        batch.map((recipient) => {
          const { content } = this.contentFor(translations, recipient)
          return {
            user_id: recipient.id,
            announcement_id: announcement.id,
            type: 'announcement',
            data: JSON.stringify({
              announcementId: announcement.id,
              title: content.title,
              body: content.body,
            }),
            created_at: now,
            updated_at: now,
          }
        })
      )
      .onConflict(['announcement_id', 'user_id'])
      .ignore()
  }

  /** Mails seulement vers des adresses vérifiées, dans la langue du destinataire. */
  private async queueMails(
    announcement: AnnouncementDeliveryRow,
    batch: AnnouncementRecipientRow[],
    translations: AnnouncementTranslations
  ): Promise<void> {
    const payloads = batch
      .filter((recipient) => recipient.email_verified_at)
      .map((recipient): SendMailPayload => {
        const { locale, content } = this.contentFor(translations, recipient)
        return {
          kind: MAIL_KINDS.announcement,
          idempotencyKey: mailIdempotencyKey(MAIL_KINDS.announcement, {
            announcement: announcement.id,
            to: recipient.email,
          }),
          to: recipient.email,
          locale,
          data: { title: content.title, body: content.body },
        }
      })

    for (let i = 0; i < payloads.length; i += MAIL_DISPATCH_CONCURRENCY) {
      await Promise.all(
        payloads
          .slice(i, i + MAIL_DISPATCH_CONCURRENCY)
          .map((payload) => SendMailJob.dispatch(payload))
      )
    }
  }
}
