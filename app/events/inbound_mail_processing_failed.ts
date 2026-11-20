import type { InboundMailProcessingFailure } from '#shared/types/inbound_mail'

/**
 * Le traitement d'un mail entrant a épuisé ses tentatives (#227) : le mail reste
 * `failed` dans le journal. Émis par `ProcessInboundMailJob#failed` ; l'écouteur
 * alerte l'équipe, une fois par mail.
 */
export default class InboundMailProcessingFailed {
  constructor(public failure: InboundMailProcessingFailure) {}
}
