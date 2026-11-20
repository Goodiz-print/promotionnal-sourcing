import LocalizedMail from '#mails/localized_mail'
import type { Locale } from '#shared/types/i18n'
import type { SubscriptionExpiringMailData } from '#shared/types/mail'

/**
 * Rappel avant la fin d'un abonnement manuel (#237) : 30 jours (annuel) puis
 * 7 jours avant. Invite à renouveler depuis la page tarifs.
 */
export default class SubscriptionExpiringNotification extends LocalizedMail {
  constructor(
    private email: string,
    private data: SubscriptionExpiringMailData,
    locale: Locale
  ) {
    super(locale)
  }

  prepare() {
    const planName = this.t(`subscription.plans.${this.data.plan}.name`)
    this.message.to(this.email).subject(
      this.t('emails.subscriptionExpiring.subject', {
        planName,
        endsOn: this.data.endsOn,
      })
    )
    this.htmlViewIn('emails/subscription_expiring', { ...this.data, planName })
  }
}
