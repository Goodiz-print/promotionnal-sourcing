import LocalizedMail from '#mails/localized_mail'
import type { Locale } from '#shared/types/i18n'
import type { AgencyReviewDecisionMailData } from '#shared/types/mail'

/**
 * Prévient les responsables d'une agence de la décision prise sur son inscription
 * (`AgencyReviewNotificationService`) : validée, refusée, ou demande d'informations.
 * `reason` est le motif saisi par l'opérateur ; absent pour une approbation.
 */
export default class AgencyReviewDecisionNotification extends LocalizedMail {
  constructor(
    private email: string,
    private organizationName: string,
    private decision: AgencyReviewDecisionMailData['decision'],
    private reason: string | null,
    locale: Locale
  ) {
    super(locale)
  }

  prepare() {
    this.message.to(this.email).subject(
      this.t(`emails.agencyReview.${this.decision}.subject`, {
        organizationName: this.organizationName,
      })
    )
    this.htmlViewIn('emails/agency_review_decision', {
      organizationName: this.organizationName,
      decision: this.decision,
      reason: this.reason,
    })
  }
}
