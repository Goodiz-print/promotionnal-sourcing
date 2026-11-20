import type { Locale } from './i18n.js'
import type { ContactRequestType } from './marketing.js'
import type { NotificationData, NotificationType } from './notification.js'
import type { PaidSubscriptionPlan } from './subscription.js'

/**
 * Charges des mails transactionnels envoyés via la queue (`SendMailJob`).
 *
 * Le payload d'un job transite par la base (`queue_jobs`) : il doit rester
 * **sérialisable**. On n'y met donc ni instance de mailer, ni modèle Lucid —
 * uniquement des données déjà résolues par l'appelant (destinataire, libellés,
 * URL signée…) ou des identifiants rechargés dans `execute()`.
 */

/** Discriminant identifiant le mail à reconstruire côté worker. */
export const MAIL_KINDS = {
  organizationInvitation: 'organization-invitation',
  rfqReceived: 'rfq-received',
  rfqReminder: 'rfq-reminder',
  quoteReceived: 'quote-received',
  passwordReset: 'password-reset',
  emailVerification: 'email-verification',
  contactRequest: 'contact-request',
  agencyReviewDecision: 'agency-review-decision',
  announcement: 'announcement',
  notificationReminder: 'notification-reminder',
  subscriptionActivated: 'subscription-activated',
  subscriptionExpiring: 'subscription-expiring',
} as const

export type MailKind = (typeof MAIL_KINDS)[keyof typeof MAIL_KINDS]

/** Données propres au mail d'invitation (`OrganizationInvitationNotification`). */
export interface OrganizationInvitationMailData {
  organizationName: string
  roleName: string
  inviterName: string
  acceptUrl: string
}

/**
 * Données du mail « nouvelle demande de devis » (`RfqReceivedNotification`),
 * envoyé aux destinataires d'une RFQ au moment de l'envoi.
 *
 * `rfqPath` est un chemin **relatif** (`/fr/supplier/rfqs/12`), pas une URL
 * absolue : la charge est persistée dans `queue_jobs` et peut être rejouée
 * bien plus tard, éventuellement après un changement de domaine. Le template
 * la préfixe avec le global `appUrl` de `config/mail.ts`, résolu au rendu.
 */
export interface RfqReceivedMailData {
  buyerName: string
  rfqTitle: string
  itemCount: number
  /** Échéance déjà formatée par l'appelant (le worker n'a pas de locale). */
  deadline: string | null
  rfqPath: string
  /**
   * Adresse relais du couple demande / fournisseur, posée en `Reply-To` (#223).
   * Absente si la réception est désactivée ou sur un job antérieur à #223.
   */
  replyTo?: string | null
}

/**
 * Données du mail de relance (`RfqReminderNotification`) : un fournisseur qui n'a
 * pas ouvert une demande reçue il y a plusieurs jours. Mêmes conventions que
 * `RfqReceivedMailData` (chemin relatif, échéance déjà formatée).
 */
export interface RfqReminderMailData {
  buyerName: string
  rfqTitle: string
  deadline: string | null
  rfqPath: string
  /** Même adresse relais que le mail de demande. */
  replyTo?: string | null
}

/**
 * Données du mail « nouveau devis » (`QuoteReceivedNotification`), envoyé aux
 * responsables de l'organisation acheteuse quand un fournisseur remet un devis.
 * `total` est déjà formaté (montant et devise, dans la langue du destinataire) ;
 * `quotePath` est un chemin relatif, comme `RfqReceivedMailData#rfqPath`.
 */
export interface QuoteReceivedMailData {
  supplierName: string
  rfqTitle: string
  total: string
  quotePath: string
}

/**
 * Données du mail de réinitialisation du mot de passe
 * (`PasswordResetNotification`). `resetUrl` est une URL signée complète,
 * déjà générée par `PasswordResetService` ; `expiresInMinutes` n'est là que
 * pour l'afficher (la validité réelle est portée par la signature).
 */
export interface PasswordResetMailData {
  resetUrl: string
  expiresInMinutes: number
}

/**
 * Données du mail de vérification d'adresse (`EmailVerificationNotification`).
 * `verifyUrl` est une URL signée complète, déjà générée par
 * `EmailVerificationService`.
 */
export interface EmailVerificationMailData {
  verifyUrl: string
  expiresInHours: number
}

/**
 * Données de la demande reçue par le formulaire de contact de la landing
 * (`ContactRequestNotification`). Mail **interne** : `to` est l'adresse de
 * l'équipe (contact@ ou partners@), `replyTo` celle du visiteur. `locale` (hissée
 * hors de `data`) reste la langue du destinataire — l'équipe, donc le français —
 * tandis que `requesterLocale` est la langue de la page d'où la demande est partie.
 */
export interface ContactRequestMailData {
  type: ContactRequestType
  name: string
  company: string
  email: string
  phone: string | null
  message: string
  requesterLocale: Locale
}

/**
 * Données du mail de décision sur une inscription agence
 * (`AgencyReviewDecisionNotification`) : approbation, rejet ou demande
 * d'informations. `reason` est le motif (ou le message) saisi par l'opérateur.
 */
export interface AgencyReviewDecisionMailData {
  organizationName: string
  decision: 'approved' | 'rejected' | 'info_requested'
  reason: string | null
}

/**
 * Données du mail d'une annonce plateforme (`AnnouncementNotification`) : titre et
 * texte déjà choisis dans la langue du destinataire par la distribution (#169).
 */
export interface AnnouncementMailData {
  title: string
  body: string
}

/**
 * Données du mail de rappel d'une notification in-app restée non lue
 * (`NotificationReminderNotification`, #243). Le mail reprend le texte de la
 * notification (`notifications.types.<type>`, paramètres `notificationData`),
 * rendu dans la langue du destinataire. `path` est relatif, préfixé par `appUrl`.
 */
export interface NotificationReminderMailData {
  notificationType: NotificationType
  notificationData: NotificationData
  path: string
}

/**
 * Données du mail d'activation d'un abonnement manuel (#237). Dates déjà
 * formatées dans la langue du destinataire (jour de fin **inclus**) ; `path`
 * relatif vers la page tarifs, préfixé par `appUrl`.
 */
export interface SubscriptionActivatedMailData {
  organizationName: string
  plan: PaidSubscriptionPlan
  startsOn: string
  endsOn: string | null
  path: string
}

/**
 * Données du rappel avant la fin d'un abonnement manuel (#237) : 30 jours
 * (abonnement annuel) puis 7 jours avant la fin. Invite à renouveler.
 */
export interface SubscriptionExpiringMailData {
  organizationName: string
  plan: PaidSubscriptionPlan
  endsOn: string
  daysLeft: number
  path: string
}

/**
 * `to` est hissé hors de `data` : il est commun à tous les mails, ce qui permet
 * de loguer le destinataire dans `failed()` sans connaître le `kind`.
 *
 * `locale` est la langue **du destinataire**, résolue par l'appelant à la mise
 * en queue (le worker n'a ni requête HTTP ni utilisateur connecté) : sujet,
 * gabarit et dates sont rendus dans cette langue. Une charge mise en queue avant
 * #58 n'en a pas : `SendMailJob` retombe alors sur la langue par défaut.
 *
 * Union **discriminée par `kind`** : ajouter un membre sans le traiter dans
 * `SendMailJob#buildMail()` est une erreur de compilation.
 */
export type SendMailContent =
  | {
      kind: typeof MAIL_KINDS.organizationInvitation
      to: string
      locale: Locale
      data: OrganizationInvitationMailData
    }
  | {
      kind: typeof MAIL_KINDS.rfqReceived
      to: string
      locale: Locale
      data: RfqReceivedMailData
    }
  | {
      kind: typeof MAIL_KINDS.rfqReminder
      to: string
      locale: Locale
      data: RfqReminderMailData
    }
  | {
      kind: typeof MAIL_KINDS.quoteReceived
      to: string
      locale: Locale
      data: QuoteReceivedMailData
    }
  | {
      kind: typeof MAIL_KINDS.passwordReset
      to: string
      locale: Locale
      data: PasswordResetMailData
    }
  | {
      kind: typeof MAIL_KINDS.contactRequest
      to: string
      locale: Locale
      data: ContactRequestMailData
    }
  | {
      kind: typeof MAIL_KINDS.emailVerification
      to: string
      locale: Locale
      data: EmailVerificationMailData
    }
  | {
      kind: typeof MAIL_KINDS.agencyReviewDecision
      to: string
      locale: Locale
      data: AgencyReviewDecisionMailData
    }
  | {
      kind: typeof MAIL_KINDS.announcement
      to: string
      locale: Locale
      data: AnnouncementMailData
    }
  | {
      kind: typeof MAIL_KINDS.notificationReminder
      to: string
      locale: Locale
      data: NotificationReminderMailData
    }
  | {
      kind: typeof MAIL_KINDS.subscriptionActivated
      to: string
      locale: Locale
      data: SubscriptionActivatedMailData
    }
  | {
      kind: typeof MAIL_KINDS.subscriptionExpiring
      to: string
      locale: Locale
      data: SubscriptionExpiringMailData
    }

/**
 * Charge complète d'un `SendMailJob` : le contenu du mail + sa **clé
 * d'idempotence**, calculée par l'appelant à la mise en queue (cf.
 * `mailIdempotencyKey`). Deux exécutions de la même clé n'envoient qu'un mail.
 */
export type SendMailPayload = SendMailContent & { idempotencyKey: string }

/** États d'une ligne `mail_deliveries` (registre d'idempotence + dead-letter). */
export const MAIL_DELIVERY_STATUSES = {
  sent: 'sent',
  failed: 'failed',
} as const

export type MailDeliveryStatus =
  (typeof MAIL_DELIVERY_STATUSES)[keyof typeof MAIL_DELIVERY_STATUSES]

/** Ligne de la dead-letter, telle que lue par `mail:retry`. */
export interface FailedMailDelivery {
  idempotencyKey: string
  kind: string
  to: string
  error: string | null
  attempts: number
  /** `null` si la charge n'est plus disponible (rejeu impossible). */
  payload: SendMailPayload | null
}

/** Données de l'événement `MailDeliveryFailed`. */
export interface MailDeliveryFailure {
  idempotencyKey: string
  kind: string
  to: string
  error: string
  attempts: number
}
