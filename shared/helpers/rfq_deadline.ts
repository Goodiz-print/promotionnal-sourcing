import type { DateTime } from 'luxon'
import type { RfqDeadlineState } from '../types/rfq.js'

/**
 * Une réponse reçue maintenant est-elle **tardive** (#232) ? Oui si la demande
 * a expiré, ou si elle est encore publiée mais que son échéance est passée — le
 * job d'expiration passe à 00:10, la demande est échue de fait dès minuit.
 *
 * `startOfToday` est le début du jour dans `RFQ_DEADLINE_TIMEZONE` : une
 * échéance au 30 laisse toute la journée du 30. Une demande close n'attend plus
 * rien : ce qui arrive après n'est pas une réponse tardive.
 */
export function isLateReply(rfq: RfqDeadlineState, startOfToday: DateTime): boolean {
  if (rfq.status === 'expired') return true
  if (rfq.status !== 'published' || !rfq.deadline) return false
  return rfq.deadline < startOfToday
}
