import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import app from '@adonisjs/core/services/app'

/**
 * Reprise planifiée des mails entrants non aboutis (cf. `start/scheduler.ts`,
 * `InboundMailService#recoverStale`) : remet en file ceux qu'un worker tué a
 * laissés `processing`, ceux dont le job a épuisé ses tentatives et ceux dont
 * la mise en file s'est perdue.
 *
 * Exception aux « imports en haut du fichier » : `InboundMailService` importe
 * des modèles Lucid, il est donc résolu dans `execute()` (la queue charge les
 * jobs au boot, avant que les modèles puissent être évalués).
 */
export default class RecoverInboundMailsJob extends Job {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 3,
  }

  async execute() {
    const { default: InboundMailService } = await import('#services/inbound_mail_service')
    const inboundMails = await app.container.make(InboundMailService)

    const recovered = await inboundMails.recoverStale()
    if (recovered > 0) logger.info({ recovered }, 'stale inbound mails requeued')
  }

  async failed(error: Error) {
    logger.error({ err: error }, 'inbound mail recovery failed')
  }
}
