import { mailIdempotencyKey } from '#shared/helpers/mail'
import { MAIL_KINDS, type SendMailPayload } from '#shared/types/mail'
import type { AgencyMessageMailInput, AgencyMessageVariant } from '#shared/types/conversation'

/**
 * Charge du mail qui relaie un message de l'agence à une adresse du fournisseur
 * (#226). La clé d'idempotence porte le message du fil et l'adresse : un
 * événement rejoué n'envoie rien de plus.
 */
export function agencyMessageMail({
  notice,
  address,
  rfqPath,
}: AgencyMessageMailInput): SendMailPayload {
  return {
    kind: MAIL_KINDS.agencyMessageRelayed,
    idempotencyKey: mailIdempotencyKey(MAIL_KINDS.agencyMessageRelayed, {
      message: notice.messageId,
      to: address.email,
    }),
    to: address.email,
    locale: address.locale,
    data: {
      agencyName: notice.agencyName,
      rfqTitle: notice.rfqTitle,
      body: notice.body,
      attachments: notice.attachments,
      rfqPath,
      replyTo: notice.replyTo,
      headers: notice.headers,
    },
  }
}

/**
 * Variante des textes du mail relayé : l'agence nommée (fournisseur abonné) ou
 * anonyme (#220).
 */
export function agencyMessageVariant(agencyName: string | null): AgencyMessageVariant {
  return agencyName ? 'named' : 'anonymous'
}
