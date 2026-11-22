import LocalizedMail from '#mails/localized_mail'
import { agencyMessageVariant } from '#shared/helpers/agency_message'
import type { AgencyMessageVariant } from '#shared/types/conversation'
import type { Locale } from '#shared/types/i18n'
import type { AgencyMessageRelayedMailData } from '#shared/types/mail'

/**
 * Relaie au fournisseur un message de l'agence (#226), écrit dans l'application
 * ou envoyé par mail à l'adresse relais `agency-`.
 *
 * Rien n'y désigne l'agence d'un fournisseur non abonné (#220) : l'expéditeur
 * est la plateforme (`From` du mailer), le `Reply-To` est l'adresse relais
 * **côté fournisseur** (`rfq-`), et seuls les en-têtes de priorité du mail
 * d'origine sont repris (`relayableHeaders`). Le corps, lui, est relayé tel
 * quel : une signature peut nommer l'agence, le client l'accepte.
 */
export default class AgencyMessageRelayedNotification extends LocalizedMail {
  constructor(
    private email: string,
    private data: AgencyMessageRelayedMailData,
    locale: Locale
  ) {
    super(locale)
  }

  prepare() {
    const variant = agencyMessageVariant(this.data.agencyName)
    this.addressMessage(variant)
    this.renderViews(variant)
  }

  /** Valeurs reprises par les textes traduits. */
  private get texts() {
    return { agencyName: this.data.agencyName, rfqTitle: this.data.rfqTitle }
  }

  /** Destinataire, sujet, en-têtes de priorité repris et `Reply-To` relais. */
  private addressMessage(variant: AgencyMessageVariant) {
    const { headers, replyTo } = this.data
    this.message
      .to(this.email)
      .subject(this.t(`emails.agencyMessageRelayed.subject.${variant}`, this.texts))
    Object.entries(headers).forEach(([name, value]) => this.message.header(name, value))
    this.relayRepliesTo(replyTo)
  }

  /** Gabarits HTML et texte, avec les textes de la variante. */
  private renderViews(variant: AgencyMessageVariant) {
    const { agencyName, rfqTitle, body, attachments, rfqPath, replyTo } = this.data
    const state = {
      agencyName,
      rfqTitle,
      body,
      attachments,
      rfqPath,
      title: this.t(`emails.agencyMessageRelayed.title.${variant}`, this.texts),
      intro: this.t('emails.agencyMessageRelayed.body', this.texts),
      canReply: Boolean(replyTo),
    }
    this.htmlViewIn('emails/agency_message_relayed', state)
    this.textViewIn('emails/agency_message_relayed_text', state)
  }
}
