import LocalizedMail from '#mails/localized_mail'
import type { Locale } from '#shared/types/i18n'

/**
 * Mail d'invitation à rejoindre une organisation. `acceptUrl` est déjà
 * généré (URL signée) par le service appelant — ce mail ne fait que
 * l'afficher, il ne génère rien lui-même.
 *
 * Rédigé dans la langue de **l'inviteur** : l'invité n'a pas encore de compte,
 * donc pas de langue connue (et le lien d'acceptation pointe vers la même).
 */
export default class OrganizationInvitationNotification extends LocalizedMail {
  constructor(
    private email: string,
    private organizationName: string,
    private roleName: string,
    private inviterName: string,
    private acceptUrl: string,
    locale: Locale
  ) {
    super(locale)
  }

  prepare() {
    this.message.to(this.email).subject(this.t('emails.invitation.subject'))
    this.htmlViewIn('emails/organization_invitation', {
      organizationName: this.organizationName,
      roleName: this.roleName,
      inviterName: this.inviterName,
      acceptUrl: this.acceptUrl,
    })
  }
}
