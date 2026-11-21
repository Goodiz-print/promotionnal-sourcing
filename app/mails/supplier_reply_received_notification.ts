import LocalizedMail from '#mails/localized_mail'
import type { Locale } from '#shared/types/i18n'
import type { SupplierReplyReceivedMailData } from '#shared/types/mail'

/**
 * Transmet à l'agence la réponse qu'un fournisseur a envoyée par mail (#225) :
 * son texte et un lien de téléchargement authentifié par devis PDF — la version
 * au nom de l'agence pour un fournisseur non abonné (#238), sinon l'original.
 *
 * L'expéditeur reste la plateforme (`From` du mailer), jamais l'adresse du
 * fournisseur. `replyTo` est l'adresse relais **côté agence** du fil : #226 y
 * branchera le relais vers le fournisseur. D'ici là, une réponse à ce mail est
 * journalisée sans être transmise : le mail n'invite donc pas encore à
 * répondre (`canReply` à `false`, pied de page « automatique »).
 */
export default class SupplierReplyReceivedNotification extends LocalizedMail {
  constructor(
    private email: string,
    private data: SupplierReplyReceivedMailData,
    locale: Locale
  ) {
    super(locale)
  }

  prepare() {
    const { replyTo, ...rest } = this.data
    const texts = { supplierName: rest.supplierName, rfqTitle: rest.rfqTitle }
    this.message.to(this.email).subject(this.t('emails.supplierReplyReceived.subject', texts))
    this.relayRepliesTo(replyTo)

    const state = {
      ...rest,
      title: this.t('emails.supplierReplyReceived.title', texts),
      intro: this.t('emails.supplierReplyReceived.body', texts),
      canReply: false,
    }
    this.htmlViewIn('emails/supplier_reply_received', state)
    this.textViewIn('emails/supplier_reply_received_text', state)
  }
}
