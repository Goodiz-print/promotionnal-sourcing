import { Exception } from '@adonisjs/core/exceptions'

/** La requête de webhook n'est pas signée par le prestataire (ou trop ancienne). */
export class InboundMailSignatureException extends Exception {
  static status = 403
  static code = 'E_INBOUND_MAIL_SIGNATURE'

  constructor(reason = 'invalid signature') {
    super(`Inbound mail webhook rejected: ${reason}`)
  }
}

/** La réception n'est pas configurée (`INBOUND_MAIL_PROVIDER`, domaine, clés). */
export class InboundMailUnavailableException extends Exception {
  static status = 503
  static code = 'E_INBOUND_MAIL_UNAVAILABLE'

  constructor() {
    super('Inbound mail is not configured')
  }
}

/** Le prestataire n'a pas pu fournir le contenu d'un mail ou d'une pièce jointe. */
export class InboundMailProviderException extends Exception {
  static status = 502
  static code = 'E_INBOUND_MAIL_PROVIDER'

  constructor(operation: string, status: number) {
    super(`Inbound mail provider failed (${operation}, HTTP ${status})`)
  }
}

/** Le mail journalisé désigné par un job n'existe plus. */
export class InboundMailNotFoundException extends Exception {
  static status = 404
  static code = 'E_INBOUND_MAIL_NOT_FOUND'

  constructor(id: number) {
    super(`Inbound mail ${id} not found`)
  }
}
