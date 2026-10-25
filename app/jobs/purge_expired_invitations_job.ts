import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import app from '@adonisjs/core/services/app'

/**
 * Purge planifiée des invitations d'organisation (cf. `start/scheduler.ts`) :
 * bascule en `expired` celles dont l'échéance est dépassée, puis supprime les
 * invitations en état terminal au-delà de la durée de rétention.
 *
 * ⚠️ Exception à la règle « imports en haut du fichier » : la queue charge les
 * modules de job **au boot** (`loadJobs`), or `OrganizationInvitationsService`
 * importe des **modèles Lucid** — les évaluer à ce stade casse la résolution du
 * service `hash` (`@adonisjs/auth`). Le service est donc importé et résolu dans
 * `execute()`, à l'image de `ExpireRfqsJob`. Voir la règle DI de `CLAUDE.md`.
 */
export default class PurgeExpiredInvitationsJob extends Job {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 3,
  }

  async execute() {
    const { default: OrganizationInvitationsService } =
      await import('#services/organization_invitations_service')
    const service = await app.container.make(OrganizationInvitationsService)

    const { expired, deleted } = await service.purgeExpired()
    if (expired > 0 || deleted > 0) {
      logger.info({ expired, deleted }, 'organization invitations purged')
    }
  }

  async failed(error: Error) {
    logger.error({ err: error }, 'purge expired invitations failed')
  }
}
