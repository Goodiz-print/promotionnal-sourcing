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
 * `to` est hissé hors de `data` : il est commun à tous les mails, ce qui permet
 * de loguer le destinataire dans `failed()` sans connaître le `kind`.
 */
export type SendMailPayload = {
  kind: typeof MAIL_KINDS.organizationInvitation
  to: string
  data: OrganizationInvitationMailData
}
