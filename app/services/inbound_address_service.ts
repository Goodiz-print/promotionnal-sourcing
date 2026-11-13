import { DateTime } from 'luxon'
import inboundMailConfig from '#config/inbound_mail'
import { parseMailAddress, replyAddress, replyTokenFrom } from '#shared/helpers/inbound_mail'
import type Rfq from '#models/rfq'
import type RfqSupplier from '#models/rfq_supplier'

/**
 * Adresse relais d'un couple demande / fournisseur : `rfq-<jeton>@<domaine>`
 * (#223). Une seule adresse par couple, posée en `Reply-To` sur les mails de
 * demande et de relance ; le jeton (`rfq_suppliers.reply_token`) identifie le
 * couple à la réception, l'expéditeur du mail n'authentifie rien.
 *
 * N'importe les modèles qu'en `import type` : utilisable depuis un service
 * chargé par un job.
 */
export default class InboundAddressService {
  /** La réception est-elle configurée ? Sinon aucun `Reply-To` n'est posé. */
  get enabled(): boolean {
    return inboundMailConfig.enabled && Boolean(inboundMailConfig.domain)
  }

  /**
   * Adresse relais du destinataire, ou `null` si la réception est désactivée.
   * Le jeton est généré par la base : une ligne tout juste créée en mémoire ne
   * le porte pas encore, elle est alors relue.
   */
  async addressFor(recipient: RfqSupplier): Promise<string | null> {
    const domain = inboundMailConfig.domain
    if (!this.enabled || !domain) return null

    if (!recipient.replyToken) await recipient.refresh()
    return replyAddress(recipient.replyToken, domain)
  }

  /** Jeton visé par un mail entrant, parmi toutes les adresses qu'il désigne. */
  tokenFrom(recipients: string[]): string | null {
    const domain = inboundMailConfig.domain
    return domain ? replyTokenFrom(recipients, domain) : null
  }

  /**
   * L'adresse appartient-elle au domaine relais (détection des boucles) ?
   * Accepte la forme `Nom <adresse>`.
   */
  isRelayAddress(address: string): boolean {
    const domain = inboundMailConfig.domain
    return Boolean(domain) && parseMailAddress(address).address.endsWith(`@${domain}`)
  }

  /**
   * L'adresse relais d'une demande est-elle périmée ? Elle reste valide tant
   * que la demande est publiée, puis pendant `graceDays` après sa clôture ou
   * son expiration : une réponse tardive vaut mieux qu'une réponse perdue.
   * (#232 adaptera cette règle au parcours par mail.)
   */
  isExpired(rfq: Rfq, now: DateTime = DateTime.now()): boolean {
    if (rfq.status === 'published') return false
    const endedAt = rfq.closedAt ?? rfq.expiredAt
    if (!endedAt) return true
    return now > endedAt.plus({ days: inboundMailConfig.graceDays })
  }
}
