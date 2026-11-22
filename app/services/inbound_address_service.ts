import { DateTime } from 'luxon'
import inboundMailConfig from '#config/inbound_mail'
import {
  agencyReplyAddress,
  isRelayWindowClosed,
  parseMailAddress,
  RELAY_TOKEN_FIELDS,
  relayTargetFrom,
  replyAddress,
} from '#shared/helpers/inbound_mail'
import type Rfq from '#models/rfq'
import type RfqSupplier from '#models/rfq_supplier'
import type { ConversationSide } from '#shared/types/conversation'
import type { RelayTarget } from '#shared/types/inbound_mail'

/** Construction de l'adresse relais de chaque côté, à partir de son jeton. */
const RELAY_ADDRESS_BUILDERS: Record<ConversationSide, (token: string, domain: string) => string> =
  {
    supplier: replyAddress,
    agency: agencyReplyAddress,
  }

/**
 * Adresses relais d'un couple demande / fournisseur, **une par côté** (#223,
 * #225, #226) :
 *
 *  - `rfq-<reply_token>@<domaine>`, donnée au **fournisseur** (`Reply-To` des
 *    mails de demande, de relance et des messages relayés de l'agence) ;
 *  - `agency-<agency_reply_token>@<domaine>`, donnée à l'**agence** (`Reply-To`
 *    des réponses du fournisseur qui lui sont transmises).
 *
 * Le préfixe dit donc qui écrit, le jeton désigne le couple ; l'expéditeur du
 * mail n'authentifie rien. Les deux jetons sont distincts : un côté ne connaît
 * jamais celui de l'autre, il ne peut pas écrire en son nom.
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
   * Adresse relais côté fournisseur, ou `null` si la réception est désactivée.
   */
  addressFor(recipient: RfqSupplier): Promise<string | null> {
    return this.relayAddressFor(recipient, 'supplier')
  }

  /**
   * Adresse relais côté agence du même couple (#225), posée en `Reply-To` du
   * mail qui transmet la réponse du fournisseur ; `null` si la réception est
   * désactivée. Son jeton (`agency_reply_token`) est **distinct** de celui du
   * fournisseur : l'agence ne doit jamais lire `reply_token`, qui suffit à
   * écrire au nom du fournisseur.
   */
  agencyAddressFor(recipient: RfqSupplier): Promise<string | null> {
    return this.relayAddressFor(recipient, 'agency')
  }

  /**
   * Adresse relais par laquelle `side` écrit à l'autre côté, ou `null` si la
   * réception est désactivée. Le jeton est généré par la base : une ligne tout
   * juste créée en mémoire ne le porte pas encore, elle est alors relue.
   */
  async relayAddressFor(recipient: RfqSupplier, side: ConversationSide): Promise<string | null> {
    const domain = inboundMailConfig.domain
    if (!this.enabled || !domain) return null

    const field = RELAY_TOKEN_FIELDS[side]
    if (!recipient[field]) await recipient.refresh()
    return RELAY_ADDRESS_BUILDERS[side](recipient[field], domain)
  }

  /**
   * Adresse relais visée par un mail entrant, parmi toutes celles qu'il
   * désigne : le côté qui écrit et le jeton du couple (#226).
   */
  targetFrom(recipients: string[]): RelayTarget | null {
    const domain = inboundMailConfig.domain
    return domain ? relayTargetFrom(recipients, domain) : null
  }

  /**
   * Côté qui a écrit un mail adressé à `recipient`. Une adresse qui n'est pas
   * une adresse relais (mail rattaché à la main par un admin, #227) vaut une
   * réponse du fournisseur, le cas d'origine.
   */
  sideOf(recipient: string | null): ConversationSide {
    return (recipient && this.targetFrom([recipient])?.side) || 'supplier'
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
   * L'adresse relais d'une demande est-elle périmée (`isRelayWindowClosed`) ?
   * Le fil de la demande est alors clos, à l'écran comme par mail (#226).
   * (#232 adaptera cette règle au parcours par mail.)
   */
  isExpired(rfq: Rfq, now: DateTime = DateTime.now()): boolean {
    return isRelayWindowClosed(rfq, inboundMailConfig.graceDays, now)
  }
}
