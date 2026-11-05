import type { Locale } from './i18n.js'

/**
 * Annonces plateforme (#169) : message émis par l'équipe admin vers un segment
 * d'utilisateurs, en notification in-app et/ou par mail.
 */

/** Segments ciblables. `organization` exige l'identifiant d'une organisation. */
export const ANNOUNCEMENT_AUDIENCES = [
  'all',
  'buyers',
  'suppliers',
  'agencies',
  'organization',
] as const

export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number]

/** Cycle de vie d'un envoi : mis en queue, en cours de distribution, terminé ou échoué. */
export const ANNOUNCEMENT_STATUSES = ['queued', 'sending', 'sent', 'failed'] as const

export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number]

/** Langues saisies dans le back-office (le français est obligatoire). */
export const ANNOUNCEMENT_LOCALES = ['fr', 'en'] as const

export type AnnouncementLocale = (typeof ANNOUNCEMENT_LOCALES)[number]

export const ANNOUNCEMENT_TITLE_MAX_LENGTH = 120
export const ANNOUNCEMENT_BODY_MAX_LENGTH = 2000

/** Nombre d'utilisateurs traités par lot lors de la distribution. */
export const ANNOUNCEMENT_BATCH_SIZE = 500

export type AnnouncementContent = {
  title: string
  body: string
}

/** Contenu par langue ; un destinataire dont la langue manque reçoit un repli. */
export type AnnouncementTranslations = Partial<Record<Locale, AnnouncementContent>>

/** Charge du job `SendAnnouncementJob` : l'annonce est relue en base à l'exécution. */
export type SendAnnouncementPayload = {
  announcementId: number
}

/** Un envoi « en attente » plus ancien que ce délai (minutes) est considéré comme perdu : relançable. */
export const ANNOUNCEMENT_STALE_QUEUED_MINUTES = 15

/** Deux envois identiques du même auteur dans ce délai (secondes) n'en font qu'un (double clic, POST rejoué). */
export const ANNOUNCEMENT_DUPLICATE_WINDOW_SECONDS = 60

/** Annonce telle que la relit la distribution (colonnes de `announcements`). */
export type AnnouncementDeliveryRow = {
  id: number
  audience: AnnouncementAudience
  organization_id: number | null
  send_in_app: boolean
  send_email: boolean
  translations: AnnouncementTranslations | string
  status: AnnouncementStatus
}

/** Destinataire lu par lot lors de la distribution. */
export type AnnouncementRecipientRow = {
  id: number
  email: string
  locale: string
  email_verified_at: Date | null
}

/** Ligne de l'historique telle que lue en base, avant présentation. */
export type AdminAnnouncementDbRow = {
  id: number
  audience: AnnouncementAudience
  organization_id: number | null
  organization_name: string | null
  send_in_app: boolean
  send_email: boolean
  translations: AnnouncementTranslations | string
  status: AnnouncementStatus
  recipients_count: number
  error: string | null
  read_count: string | number
  creator_email: string | null
  created_at: Date | string
  sent_at: Date | string | null
}

export type AdminAnnouncementRow = {
  id: number
  /** Titre dans la langue du back-office, à défaut dans la langue par défaut. */
  title: string
  audience: AnnouncementAudience
  organization: { id: number; name: string } | null
  sendInApp: boolean
  sendEmail: boolean
  status: AnnouncementStatus
  /** Utilisateurs ciblés. */
  recipients: number
  /** Notifications in-app lues par leur destinataire. */
  read: number
  /** Motif de l'échec, le cas échéant. */
  error: string | null
  /** Envoi échoué ou perdu en queue : l'admin peut le relancer. */
  retryable: boolean
  createdBy: string | null
  createdAt: string
  sentAt: string | null
}

export type CreateAnnouncementInput = {
  audience: AnnouncementAudience
  organizationId: number | null
  sendInApp: boolean
  sendEmail: boolean
  translations: AnnouncementTranslations
}
