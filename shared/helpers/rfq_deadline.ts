import { DateTime } from 'luxon'
import { RFQ_DEADLINE_TIMEZONE, type RfqDeadlineState } from '../types/rfq.js'

/**
 * Minuit, heure de Paris, du jour de `now` : une échéance strictement
 * antérieure est passée. Une échéance est une **date** — « 30 octobre » laisse
 * toute la journée du 30 (cf. `RFQ_DEADLINE_TIMEZONE`).
 */
export function startOfDeadlineDay(now: DateTime = DateTime.now()): DateTime {
  return now.setZone(RFQ_DEADLINE_TIMEZONE).startOf('day')
}

/**
 * Date d'échéance saisie (`AAAA-MM-JJ`), lue en heure de Paris ; `null` si elle
 * est absente ou invalide.
 */
export function parseRfqDeadline(deadline: string | null | undefined): DateTime | null {
  if (!deadline) return null
  const parsed = DateTime.fromISO(deadline, { zone: RFQ_DEADLINE_TIMEZONE })
  return parsed.isValid ? parsed : null
}

/**
 * Une demande attend-elle encore des réponses (décliner, chiffrer, accepter un
 * devis) ? Oui tant qu'elle est publiée **et** que son échéance n'est pas
 * passée. Le job d'expiration passe à 00:10 : entre minuit et lui (ou s'il
 * tarde), une demande dont l'échéance est passée est déjà échue de fait.
 */
export function acceptsResponses(rfq: RfqDeadlineState, now: DateTime = DateTime.now()): boolean {
  if (rfq.status !== 'published') return false
  return !rfq.deadline || rfq.deadline >= startOfDeadlineDay(now)
}

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
 * `receptionDayStart` est le début du jour de réception (`startOfDeadlineDay`).
 */
export function isLateReply(rfq: RfqDeadlineState, receptionDayStart: DateTime): boolean {
  if (rfq.status !== 'published' && rfq.status !== 'expired') return false
  if (!rfq.deadline) return rfq.status === 'expired'
  return rfq.deadline < receptionDayStart
}
