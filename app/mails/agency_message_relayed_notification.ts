import LocalizedMail from '#mails/localized_mail'
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
    const { replyTo, headers, ...rest } = this.data
    const texts = { agencyName: rest.agencyName, rfqTitle: rest.rfqTitle }
    const variant = rest.agencyName ? 'named' : 'anonymous'
    this.message
      .to(this.email)
      .subject(this.t(`emails.agencyMessageRelayed.subject.${variant}`, texts))
    Object.entries(headers).forEach(([name, value]) => this.message.header(name, value))
    this.relayRepliesTo(replyTo)

    const state = {
      ...rest,
      title: this.t(`emails.agencyMessageRelayed.title.${variant}`, texts),
      intro: this.t('emails.agencyMessageRelayed.body', texts),
      canReply: Boolean(replyTo),
    }
    this.htmlViewIn('emails/agency_message_relayed', state)
    this.textViewIn('emails/agency_message_relayed_text', state)
  }
}
