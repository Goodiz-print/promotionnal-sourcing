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
}

/**
 * `to` est hissé hors de `data` : il est commun à tous les mails, ce qui permet
 * de loguer le destinataire dans `failed()` sans connaître le `kind`.
 *
 * Union **discriminée par `kind`** : ajouter un membre sans le traiter dans
 * `SendMailJob#buildMail()` est une erreur de compilation.
 */
export type SendMailPayload =
  | {
      kind: typeof MAIL_KINDS.organizationInvitation
      to: string
      data: OrganizationInvitationMailData
    }
  | {
      kind: typeof MAIL_KINDS.rfqReceived
      to: string
      data: RfqReceivedMailData
    }
