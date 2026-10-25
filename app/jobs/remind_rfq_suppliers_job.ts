import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import app from '@adonisjs/core/services/app'

/**
 * Relance planifiée des fournisseurs silencieux (cf. `start/scheduler.ts`) : ceux
 * qui n'ont pas ouvert une demande reçue depuis `RFQ_REMINDER_AFTER_DAYS` jours
 * reçoivent **une** relance, consignée dans `rfq_suppliers.reminded_at`.
 *
 * Même exception aux « imports en haut du fichier » que `ExpireRfqsJob` : les
 * services importent des modèles Lucid, résolus donc dans `execute()`.
 */
export default class RemindRfqSuppliersJob extends Job {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 3,
  }

  async execute() {
    const { default: RfqService } = await import('#services/rfq_service')
    const { default: RfqNotificationService } = await import('#services/rfq_notification_service')
    const rfqs = await app.container.make(RfqService)
    const notifications = await app.container.make(RfqNotificationService)

    const reminded = await notifications.remind(await rfqs.dueForReminder())
    await rfqs.markReminded(reminded)

    if (reminded.length > 0) {
      logger.info({ count: reminded.length }, 'rfq reminders queued')
    }
  }

  async failed(error: Error) {
    logger.error({ err: error }, 'remind rfq suppliers failed')
  }
}
