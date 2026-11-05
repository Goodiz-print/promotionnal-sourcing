import { inject } from '@adonisjs/core'
import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import AiCallService from '#services/ai_call_service'

/**
 * Purge planifiée du journal des appels IA (#177) : cf. `AiCallService#purge`
 * et `start/scheduler.ts`.
 */
@inject()
export default class PurgeAiCallsJob extends Job {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 3,
  }

  constructor(private aiCalls: AiCallService) {
    super()
  }

  async execute() {
    const deleted = await this.aiCalls.purge()
    if (deleted > 0) logger.info({ deleted }, 'ai calls purged')
  }

  async failed(error: Error) {
    logger.error({ err: error }, 'purge ai calls failed')
  }
}
