import type { InboundMailReceivedData } from '#shared/types/inbound_mail'

/**
 * Une réponse de fournisseur vient d'être reçue par mail, authentifiée et
 * rattachée à son couple demande / fournisseur (#223). Point d'accroche de la
 * suite du parcours : enregistrement du devis (#224), transmission à l'agence
 * (#225), fil de messagerie (#226).
 */
export default class InboundMailReceived {
  constructor(public mail: InboundMailReceivedData) {}
}
