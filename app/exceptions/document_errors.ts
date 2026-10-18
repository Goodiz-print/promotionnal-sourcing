import { Exception } from '@adonisjs/core/exceptions'

/**
 * Le fichier n'est pas un PDF (en-tête `%PDF-` absent), même si son extension l'est.
 */
export class InvalidDocumentException extends Exception {
  static status = 422
  static code = 'E_DOCUMENT_INVALID'
  static message = 'The file is not a valid PDF'
}

/**
 * Document introuvable pour cette organisation ou ce produit. Indistinct d'un
 * document inexistant, pour ne rien révéler aux autres fournisseurs.
 */
export class DocumentNotFoundException extends Exception {
  static status = 404
  static code = 'E_DOCUMENT_NOT_FOUND'
  static message = 'Document not found'
}
