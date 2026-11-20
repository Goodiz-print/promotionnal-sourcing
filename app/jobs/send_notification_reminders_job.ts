import { inject } from '@adonisjs/core'
import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import NotificationReminderService from '#services/notification_reminder_service'

/**
 * Rappel par mail des notifications importantes non lues (#243, cf.
 * `start/scheduler.ts`). Import statique du service possible : il n'accède à la
 * base que par `db`, sans modèle Lucid (contrainte de chargement des jobs au boot).
 */
@inject()
export default class SendNotificationRemindersJob extends Job {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 3,
  }

  constructor(private reminders: NotificationReminderService) {
    super()
  }

  async execute() {
    const sent = await this.reminders.sendDue()

    if (sent > 0) {
      logger.info({ count: sent }, 'notification reminders queued')
    }
  }

  async failed(error: Error) {
    logger.error({ err: error }, 'send notification reminders failed')
  }
}
