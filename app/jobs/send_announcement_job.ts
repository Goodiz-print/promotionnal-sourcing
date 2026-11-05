import { inject } from '@adonisjs/core'
import { Job, exponentialBackoff } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import AnnouncementDispatcher from '#services/announcement_dispatcher'
import type { SendAnnouncementPayload } from '#shared/types/announcement'

/**
 * Distribue une annonce plateforme (#169) hors de la requête admin : un segment
 * peut compter des milliers d'utilisateurs. La distribution est rejouable (voir
 * `AnnouncementDispatcher`), donc un échec transitoire est retenté avec backoff.
 * Pas d'import de modèle Lucid : les jobs sont chargés au boot de la queue.
 */
@inject()
export default class SendAnnouncementJob extends Job<SendAnnouncementPayload> {
  static options: JobOptions = {
    queue: 'default',
    retry: {
      maxRetries: 3,
      backoff: exponentialBackoff({ baseDelay: '30s', maxDelay: '10m' }),
    },
    removeOnFail: { age: '30d' },
  }

  constructor(private dispatcher: AnnouncementDispatcher) {
    super()
  }

  async execute() {
    const recipients = await this.dispatcher.deliver(this.payload.announcementId)
    logger.info({ announcementId: this.payload.announcementId, recipients }, 'announcement sent')
  }

  async failed(error: Error) {
    logger.error({ err: error, announcementId: this.payload.announcementId }, 'announcement failed')
    await this.dispatcher.markFailed(this.payload.announcementId, error)
  }
}
