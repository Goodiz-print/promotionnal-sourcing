import { Job, exponentialBackoff } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import logger from '@adonisjs/core/services/logger'
import app from '@adonisjs/core/services/app'
import type { ProcessInboundMailPayload } from '#shared/types/inbound_mail'

/**
 * Traitement d'un mail entrant journalisé par le webhook (#223) : lecture du
 * contenu chez le prestataire, garde-fous, rattachement, pièces jointes.
 *
 * Rejoué avec un backoff si le prestataire ou Cellar ne répond pas ; le
 * traitement est idempotent (verrou de statut, pièces jointes dédoublonnées).
 * Après épuisement, la ligne reste `failed` dans `inbound_mails`, avec l'erreur.
 *
 * Exception aux « imports en haut du fichier » : `InboundMailService` importe
 * des modèles Lucid, il est donc résolu dans `execute()` (la queue charge les
 * jobs au boot, avant que les modèles puissent être évalués).
 */
export default class ProcessInboundMailJob extends Job<ProcessInboundMailPayload> {
  static options: JobOptions = {
    queue: 'default',
    retry: {
      maxRetries: 5,
      backoff: exponentialBackoff({ baseDelay: '30s', maxDelay: '15m' }),
    },
    removeOnFail: { age: '30d' },
  }

  async execute() {
    const { default: InboundMailService } = await import('#services/inbound_mail_service')
    const inboundMails = await app.container.make(InboundMailService)
    await inboundMails.process(this.payload.inboundMailId)
  }

  async failed(error: Error) {
    logger.error(
      { err: error, inboundMailId: this.payload.inboundMailId },
      'inbound mail processing permanently failed'
    )
  }
}
