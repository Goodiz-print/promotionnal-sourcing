import { inject } from '@adonisjs/core'
import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import StripeWebhookEventService from '#services/stripe_webhook_event_service'

/**
 * Purge planifiée des notifications Stripe traitées au-delà de la rétention
 * (cf. `StripeWebhookEventService#purge` et `start/scheduler.ts`).
 */
@inject()
export default class PurgeStripeWebhookEventsJob extends Job {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 3,
  }

  constructor(private events: StripeWebhookEventService) {
    super()
  }

  async execute() {
    const deleted = await this.events.purge()
    if (deleted > 0) logger.info({ deleted }, 'stripe webhook events purged')
  }

  async failed(error: Error) {
    logger.error({ err: error }, 'purge stripe webhook events failed')
  }
}
