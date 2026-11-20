import LocalizedMail from '#mails/localized_mail'
import type { Locale } from '#shared/types/i18n'
import type { RfqReceivedMailData } from '#shared/types/mail'

/**
 * Mail « nouvelle demande de devis », envoyé à un destinataire au moment où
 * l'acheteur diffuse sa demande (`RfqService#send`), dans **sa** langue.
 *
 * Depuis #219, il reprend la description et chaque ligne avec son prix
 * indicatif : le fournisseur peut chiffrer sans ouvrir la plateforme, dont le
 * lien passe au second plan. Une version texte accompagne le HTML (certains
 * logiciels de devis repartent du texte).
 *
 * `rfqPath` est relatif — le template le préfixe avec le global `appUrl`
 * (cf. `shared/types/mail.ts`) ; il porte la langue du destinataire.
 *
 * `replyTo` est l'adresse relais du couple demande / fournisseur (#223) : le
 * fournisseur répond depuis sa messagerie, la plateforme reçoit la réponse.
 */
export default class RfqReceivedNotification extends LocalizedMail {
  constructor(
    private email: string,
    private data: RfqReceivedMailData,
    locale: Locale
  ) {
    super(locale)
  }

  prepare() {
    const { buyerName, replyTo, ...rest } = this.data
    this.message.to(this.email).subject(this.t('emails.rfqReceived.subject', { buyerName }))
    this.relayRepliesTo(replyTo)

    const state = {
      ...rest,
      buyerName,
      description: rest.description ?? null,
      lines: rest.lines ?? [],
      canReply: Boolean(replyTo),
    }
    this.htmlViewIn('emails/rfq_received', state)
    this.textViewIn('emails/rfq_received_text', state)
  }
}
