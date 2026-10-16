import { Exception } from '@adonisjs/core/exceptions'

/**
 * Échec de l'envoi d'un fichier vers le stockage objet (ou de l'écriture de
 * son état). Levée par `StorageService` après nettoyage de la ligne
 * `pending_upload` et de l'objet.
 */
export class StorageUploadException extends Exception {
  static status = 500
  static code = 'E_STORAGE_UPLOAD'
  static message = "Échec de l'upload du fichier"
}

/**
 * Le même contenu est déjà en cours d'envoi par un autre appel : réessayer
 * dans un instant (l'objet sera alors `ready` et réutilisé).
 */
export class StorageUploadInProgressException extends Exception {
  static status = 409
  static code = 'E_STORAGE_UPLOAD_IN_PROGRESS'
  static message = 'Ce fichier est déjà en cours de téléversement'
}

/**
 * Le fichier temporaire de la requête est introuvable ou illisible.
 */
export class StorageSourceException extends Exception {
  static status = 422
  static code = 'E_STORAGE_SOURCE'
  static message = 'Fichier temporaire introuvable'
}
