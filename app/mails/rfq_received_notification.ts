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
 *
 * `buyerName` à `null` (fournisseur non abonné, #220) : objet, titre et
 * introduction ne nomment pas l'agence, et l'encart d'abonnement (#222) mène à
 * `subscribePath`.
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
    const { buyerName, replyTo, subscribePath, ...rest } = this.data
    const copy = buyerName === null ? 'emails.rfqReceived.anonymous' : 'emails.rfqReceived'
    const texts = { buyerName, rfqTitle: rest.rfqTitle, itemCount: rest.itemCount }
    this.message.to(this.email).subject(this.t(`${copy}.subject`, texts))
    this.relayRepliesTo(replyTo)

    const state = {
      ...rest,
      title: this.t(`${copy}.title`, texts),
      intro: this.t(`${copy}.body`, texts),
      subscribePath: buyerName === null ? (subscribePath ?? null) : null,
      description: rest.description ?? null,
      lines: rest.lines ?? [],
      canReply: Boolean(replyTo),
    }
    this.htmlViewIn('emails/rfq_received', state)
    this.textViewIn('emails/rfq_received_text', state)
  }
}
