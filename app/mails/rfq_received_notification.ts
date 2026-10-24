import LocalizedMail from '#mails/localized_mail'
import type { Locale } from '#shared/types/i18n'

/**
 * Mail « nouvelle demande de devis », envoyé à un destinataire au moment où
 * l'acheteur diffuse sa demande (`RfqService#send`), dans **sa** langue.
 *
 * Le sujet porte le nom de l'acheteur, connu seulement à l'instanciation :
 * il est donc posé dans `prepare()`.
 *
 * `rfqPath` est relatif — le template le préfixe avec le global `appUrl`
 * (cf. `shared/types/mail.ts`) ; il porte la langue du destinataire.
 */
export default class RfqReceivedNotification extends LocalizedMail {
  constructor(
    private email: string,
    private buyerName: string,
    private rfqTitle: string,
    private itemCount: number,
    private deadline: string | null,
    private rfqPath: string,
    locale: Locale
  ) {
    super(locale)
  }

  prepare() {
    this.message
      .to(this.email)
      .subject(this.t('emails.rfqReceived.subject', { buyerName: this.buyerName }))
    this.htmlViewIn('emails/rfq_received', {
      buyerName: this.buyerName,
      rfqTitle: this.rfqTitle,
      itemCount: this.itemCount,
      deadline: this.deadline,
      rfqPath: this.rfqPath,
    })
  }
}
