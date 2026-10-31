import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import app from '@adonisjs/core/services/app'
import type { ActivityEventPayload } from '#shared/types/activity_event'

/**
 * Écrit un événement de consultation (#172) hors de la requête HTTP.
 *
 * ⚠️ Exception à la règle « imports en haut du fichier » : `ActivityEventService`
 * importe un **modèle Lucid**, que la queue ne doit pas évaluer au boot
 * (`loadJobs`). Le service est importé et résolu dans `execute()`, comme
 * `RecordSearchEventJob`. Voir la règle DI de `CLAUDE.md`.
 */
export default class RecordActivityEventJob extends Job<ActivityEventPayload> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 2,
  }

  async execute() {
    const { default: ActivityEventService } = await import('#services/activity_event_service')
    const service = await app.container.make(ActivityEventService)
    await service.store(this.payload)
  }

  async failed(error: Error) {
    logger.warn({ err: error }, 'activity event not recorded')
  }
}
