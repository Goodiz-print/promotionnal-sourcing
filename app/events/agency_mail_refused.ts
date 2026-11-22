import type { AgencyMailRefusedData } from '#shared/types/inbound_mail'

/**
 * Un mail reçu à l'adresse relais `agency-` a été écarté : son expéditeur n'est
 * pas un membre authentifié de l'agence (`unknown_sender`, #226). Rien n'est
 * parti au fournisseur ; l'agence en est prévenue dans l'application, jamais
 * par une réponse à l'expéditeur, qui peut être falsifié.
 */
export default class AgencyMailRefused {
  constructor(public mail: AgencyMailRefusedData) {}
}
