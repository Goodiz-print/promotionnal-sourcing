import { inject } from '@adonisjs/core'
import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import SubscriptionMailService from '#services/subscription_mail_service'
import SubscriptionScheduleService from '#services/subscription_schedule_service'

/**
 * Passage planifié sur les abonnements manuels (#214, cf. `start/scheduler.ts`) :
 * expiration des abonnements échus (retour en `free`), activation des abonnements
 * programmés dont le jour de début est atteint — cf. `SubscriptionScheduleService#syncDue` —,
 * puis mails d'activation et rappels avant la fin (#237, `SubscriptionMailService`).
 * Import statique des services possible : ils n'accèdent à la base que par `db`,
 * sans modèle Lucid (contrainte de chargement des jobs au boot).
 */
@inject()
export default class SyncSubscriptionsJob extends Job {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 3,
  }

  constructor(
    private schedule: SubscriptionScheduleService,
    private mails: SubscriptionMailService
  ) {
    super()
  }

  async execute() {
    const { activated, expired } = await this.schedule.syncDue()
    // Après le changement de statut : les abonnements activés à l'instant sont annoncés.
    const announced = await this.mails.notifyActivations()
    const reminded = await this.mails.remindExpiring()
    if (activated.length + expired.length + announced + reminded > 0) {
      logger.info(
        { activated: activated.length, expired: expired.length, announced, reminded },
        'manual subscriptions synced'
      )
    }
  }

  async failed(error: Error) {
    logger.error({ err: error }, 'sync subscriptions failed')
  }
}
