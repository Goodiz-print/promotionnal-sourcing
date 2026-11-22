import type { DateTime } from 'luxon'
import type { RfqDeadlineState } from '../types/rfq.js'

/**
 * Une réponse **reçue** le jour qui commence à `receptionDayStart` est-elle
 * tardive (#232) ? C'est l'heure de réception du mail qui compte, pas celle
 * de son traitement : un mail reçu à 23:55 la veille de l'échéance, repris
 * après minuit (`RecoverInboundMailsJob`, rejeu admin), arrive dans les temps
 * même si la demande a expiré entre-temps.
 *
 * - avec une échéance : tardive si elle est passée au jour de réception — une
 *   échéance au 30 laisse toute la journée du 30 ;
 * - sans échéance : tardive seulement si la demande a été expirée (à la main) ;
 * - une demande close ou en brouillon n'attend rien : jamais tardive.
 *
 * `receptionDayStart` est le début du jour de réception dans
 * `RFQ_DEADLINE_TIMEZONE`.
 */
export function isLateReply(rfq: RfqDeadlineState, receptionDayStart: DateTime): boolean {
  if (rfq.status !== 'published' && rfq.status !== 'expired') return false
  if (!rfq.deadline) return rfq.status === 'expired'
  return rfq.deadline < receptionDayStart
}
