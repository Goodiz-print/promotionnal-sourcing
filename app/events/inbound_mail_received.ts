import type { InboundMailReceivedData } from '#shared/types/inbound_mail'

/**
 * Un mail vient d'être reçu à une adresse relais, authentifié et rattaché à son
 * couple demande / fournisseur (#223). `side` dit qui l'a écrit (#226) : la
 * réponse d'un fournisseur (devis #224, transmission à l'agence #225) ou un
 * message de l'agence, relayé au fournisseur.
 */
export default class InboundMailReceived {
  constructor(public mail: InboundMailReceivedData) {}
}
