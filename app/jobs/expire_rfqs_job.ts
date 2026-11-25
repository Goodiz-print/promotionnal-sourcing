import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import app from '@adonisjs/core/services/app'

/**
 * Expiration planifiée des demandes de devis (cf. `start/scheduler.ts`) : bascule
 * en `expired` les demandes publiées dont l'échéance est dépassée
 * (`RfqDeadlineService#expireDue`), puis les devis encore ouverts de ces demandes et
 * ceux dont la validité est passée (`QuoteService`).
 *
 * ⚠️ Exception à la règle « imports en haut du fichier » : la queue charge les
 * modules de job **au boot** (`loadJobs`), or `RfqDeadlineService` importe des **modèles
 * Lucid** — les évaluer à ce stade casse la résolution du service `hash`
 * (`@adonisjs/auth`). Le service est donc importé et résolu dans `execute()`, à
 * l'image de `PurgeExpiredInvitationsJob`. Voir la règle DI de `CLAUDE.md`.
 */
export default class ExpireRfqsJob extends Job {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 3,
  }

  async execute() {
    const { default: RfqDeadlineService } = await import('#services/rfq_deadline_service')
    const { default: QuoteService } = await import('#services/quote_service')
    const service = await app.container.make(RfqDeadlineService)
    const quotes = await app.container.make(QuoteService)

    const expired = await service.expireDue()
    if (expired.length > 0) {
      logger.info({ count: expired.length, rfqIds: expired.map(({ id }) => id) }, 'rfqs expired')
    }

    await quotes.expireForRfqs(expired.map(({ id }) => id))
    await quotes.expireOutdated()
  }

  async failed(error: Error) {
    logger.error({ err: error }, 'expire rfqs failed')
  }
}
