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
