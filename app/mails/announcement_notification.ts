import LocalizedMail from '#mails/localized_mail'
import type { Locale } from '#shared/types/i18n'

/**
 * Annonce de la plateforme (#169). Titre et texte arrivent déjà dans la langue du
 * destinataire (choisie à la distribution, avec repli) ; seul le pied de page est
 * traduit ici.
 */
export default class AnnouncementNotification extends LocalizedMail {
  constructor(
    private email: string,
    private title: string,
    private body: string,
    locale: Locale
  ) {
    super(locale)
  }

  prepare() {
    this.message.to(this.email).subject(this.title.replace(/\s+/g, ' ').trim())
    this.htmlViewIn('emails/announcement', { title: this.title, body: this.body })
  }
}
