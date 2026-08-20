import { BaseMail } from '@adonisjs/mail'

/**
 * Mail d'invitation à rejoindre une organisation. `acceptUrl` est déjà
 * généré (URL signée) par le service appelant — ce mail ne fait que
 * l'afficher, il ne génère rien lui-même.
 */
export default class OrganizationInvitationNotification extends BaseMail {
  subject = 'Invitation à rejoindre une organisation'

  constructor(
    private email: string,
    private organizationName: string,
    private roleName: string,
    private inviterName: string,
    private acceptUrl: string
  ) {
    super()
  }

  prepare() {
    this.message.to(this.email).htmlView('emails/organization_invitation', {
      organizationName: this.organizationName,
      roleName: this.roleName,
      inviterName: this.inviterName,
      acceptUrl: this.acceptUrl,
    })
  }
}
