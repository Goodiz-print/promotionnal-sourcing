import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import app from '@adonisjs/core/services/app'

/**
 * Passage planifié sur les abonnements manuels (#214, cf. `start/scheduler.ts`) :
 * expiration des abonnements échus (retour en `free`), activation des abonnements
 * programmés dont le jour de début est atteint — cf. `ManualSubscriptionService#syncDue`.
 *
 * ⚠️ Exception à la règle « imports en haut du fichier » : la queue charge les
 * modules de job **au boot** (`loadJobs`), or le service importe des **modèles
 * Lucid**. Il est donc importé et résolu dans `execute()`, à l'image de
 * `ExpireRfqsJob`. Voir la règle DI de `CLAUDE.md`.
 */
export default class SyncSubscriptionsJob extends Job {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 3,
  }

  async execute() {
    const { default: ManualSubscriptionService } =
      await import('#services/manual_subscription_service')
    const service = await app.container.make(ManualSubscriptionService)

    const { activated, expired } = await service.syncDue()
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
