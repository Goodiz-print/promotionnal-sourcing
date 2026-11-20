import { inject } from '@adonisjs/core'
import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import SubscriptionScheduleService from '#services/subscription_schedule_service'

/**
 * Passage planifié sur les abonnements manuels (#214, cf. `start/scheduler.ts`) :
 * expiration des abonnements échus (retour en `free`), activation des abonnements
 * programmés dont le jour de début est atteint — cf. `SubscriptionScheduleService#syncDue`.
 * Import statique du service possible : il n'accède à la base que par `db`, sans
 * modèle Lucid (contrainte de chargement des jobs au boot).
 */
@inject()
export default class SyncSubscriptionsJob extends Job {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 3,
  }

  constructor(private schedule: SubscriptionScheduleService) {
    super()
  }

  async execute() {
    const { activated, expired } = await this.schedule.syncDue()
    if (activated.length > 0 || expired.length > 0) {
      logger.info(
        { activated: activated.length, expired: expired.length },
        'manual subscriptions synced'
      )
    }
  }

  async failed(error: Error) {
    logger.error({ err: error }, 'sync subscriptions failed')
  }
}
