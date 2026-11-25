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

/**
 * Bascule en `expired` demandée sur une demande qui n'est pas publiée : un
 * brouillon n'a pas d'échéance qui court, une demande close ne se périme pas.
 */
export class RfqNotExpirableException extends Exception {
  static status = 422
  static code = 'E_RFQ_NOT_EXPIRABLE'
  static message = 'Only a published request for quotation can expire'
}

/**
 * Prolongation d'échéance demandée sur une demande qui n'est ni publiée ni
 * échue : un brouillon se modifie librement, une demande close est terminée.
 */
export class RfqNotExtendableException extends Exception {
  static status = 422
  static code = 'E_RFQ_NOT_EXTENDABLE'
  static message = 'Only a published or expired request for quotation can be extended'
}

/**
 * La nouvelle échéance est déjà passée, ou n'est pas postérieure à l'actuelle :
 * « prolonger » ne raccourcit jamais.
 */
export class RfqInvalidDeadlineException extends Exception {
  static status = 422
  static code = 'E_RFQ_INVALID_DEADLINE'
  static message = 'The new deadline must be in the future and later than the current one'
}

/**
 * Dépôt d'un devis PDF (#230) par un destinataire qui ne peut plus répondre :
 * il a décliné la demande entre l'affichage de l'écran et l'envoi du fichier
 * (statut relu sous verrou par `SupplierReplyService#recordUpload`).
 */
export class RfqSupplierNotReplyableException extends Exception {
  static status = 422
  static code = 'E_RFQ_SUPPLIER_NOT_REPLYABLE'
  static message = 'This recipient can no longer reply to the request for quotation'
}
