import { Exception } from '@adonisjs/core/exceptions'

/**
 * Échec d'un upload/suppression Cloudinary. Levée par `CloudinaryService`
 * quand l'appel distant échoue ou que le fichier source est invalide.
 */
export class CloudinaryUploadException extends Exception {
  static status = 500
  static code = 'E_CLOUDINARY_UPLOAD'
  static message = "Échec de l'upload Cloudinary"
}
