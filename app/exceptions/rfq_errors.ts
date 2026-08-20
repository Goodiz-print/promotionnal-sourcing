import { Exception } from '@adonisjs/core/exceptions'

/**
 * Demande introuvable, ou appartenant à une autre organisation que celle de
 * l'appelant — indistinguables volontairement : un acheteur ne doit pas
 * pouvoir sonder l'existence des demandes d'un concurrent.
 */
export class RfqNotFoundException extends Exception {
  static status = 404
  static code = 'E_RFQ_NOT_FOUND'
  static message = 'Request for quotation not found'
}

/**
 * Tentative de modification (titre, items, destinataires) d'une demande qui
 * n'est plus en brouillon. Une demande publiée est un engagement vis-à-vis des
 * fournisseurs déjà notifiés : elle ne se réécrit pas.
 */
export class RfqNotEditableException extends Exception {
  static status = 422
  static code = 'E_RFQ_NOT_EDITABLE'
  static message = 'Only a draft request for quotation can be edited'
}

/**
 * Publication refusée : la demande n'est plus en brouillon, ou ne comporte
 * aucun item (rien à chiffrer).
 */
export class RfqNotPublishableException extends Exception {
  static status = 422
  static code = 'E_RFQ_NOT_PUBLISHABLE'
  static message = 'This request for quotation cannot be published'
}

/**
 * Envoi refusé : la demande n'est pas publiée, ou aucun destinataire ne reste
 * à notifier.
 */
export class RfqNotSendableException extends Exception {
  static status = 422
  static code = 'E_RFQ_NOT_SENDABLE'
  static message = 'This request for quotation cannot be sent'
}

/**
 * Clôture refusée : seule une demande publiée se clôture (un brouillon se
 * supprime, une demande close l'est déjà).
 */
export class RfqNotClosableException extends Exception {
  static status = 422
  static code = 'E_RFQ_NOT_CLOSABLE'
  static message = 'Only a published request for quotation can be closed'
}

/**
 * L'organisation visée comme destinataire n'est pas un fournisseur
 * (`organization_type` ni `supplier` ni `both`), ou est archivée.
 */
export class NotASupplierOrganizationException extends Exception {
  static status = 422
  static code = 'E_NOT_A_SUPPLIER_ORGANIZATION'
  static message = 'This organization cannot receive requests for quotation'
}

/**
 * Le fournisseur visé n'est pas destinataire de cette demande (id inexistant,
 * ou demande adressée à une autre organisation).
 */
export class RfqSupplierNotFoundException extends Exception {
  static status = 404
  static code = 'E_RFQ_SUPPLIER_NOT_FOUND'
  static message = 'This supplier is not a recipient of the request for quotation'
}
