import LocalizedMail from '#mails/localized_mail'
import type { Locale } from '#shared/types/i18n'
import type { SubscriptionActivatedMailData } from '#shared/types/mail'
import { SUBSCRIPTION_FEATURES, SUBSCRIPTION_FEATURE_INCLUDED } from '#shared/types/subscription'

/**
 * Activation d'un abonnement manuel (#237), envoyée aux responsables de
 * l'organisation fournisseur : formule, période, et ce que la formule ouvre
 * (lignes de la grille tarifaire incluses dans la formule).
 */
export default class SubscriptionActivatedNotification extends LocalizedMail {
  constructor(
    private email: string,
    private data: SubscriptionActivatedMailData,
    locale: Locale
  ) {
    super(locale)
  }

  /** Droits ouverts par la formule, tels que la page tarifs les affiche. */
  get features(): string[] {
    return SUBSCRIPTION_FEATURES.filter(
      (feature) => SUBSCRIPTION_FEATURE_INCLUDED[feature][this.data.plan]
    ).map((feature) => this.t(`subscription.features.${feature}.${this.data.plan}`))
  }

  prepare() {
    const planName = this.t(`subscription.plans.${this.data.plan}.name`)
    this.message
      .to(this.email)
      .subject(this.t('emails.subscriptionActivated.subject', { planName }))
    this.htmlViewIn('emails/subscription_activated', {
      ...this.data,
      planName,
      features: this.features,
    })
  }
}
