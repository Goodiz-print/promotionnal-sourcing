import { StripeWebhookEventSchema } from '#database/schema'

/** Notification Stripe d'abonnement déjà traitée (idempotence des webhooks). */
export default class StripeWebhookEvent extends StripeWebhookEventSchema {
  static table = 'stripe_webhook_events'
}
