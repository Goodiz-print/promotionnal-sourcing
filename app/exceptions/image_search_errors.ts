import { Exception } from '@adonisjs/core/exceptions'

/**
 * La recherche par image est coupée (`AI_VISION_ENABLED`) ou sans clé du fournisseur IA actif.
 */
export class ImageSearchDisabledError extends Exception {
  static status = 503
  static code = 'E_IMAGE_SEARCH_DISABLED'

  constructor() {
    super('Image search is disabled', { code: 'E_IMAGE_SEARCH_DISABLED', status: 503 })
  }
}

/**
 * Le fichier n'est pas une image exploitable (contenu illisible malgré l'extension).
 */
export class InvalidImageError extends Exception {
  static status = 422
  static code = 'E_IMAGE_SEARCH_INVALID_IMAGE'

  constructor() {
    super('The uploaded file is not a readable image', {
      code: 'E_IMAGE_SEARCH_INVALID_IMAGE',
      status: 422,
    })
  }
}

/**
 * Échec ou réponse inexploitable du modèle vision.
 */
export class ImageDescriptionFailedError extends Exception {
  static status = 502
  static code = 'E_IMAGE_SEARCH_DESCRIPTION'

  constructor(detail: string) {
    super(`Image description failed: ${detail}`, {
      code: 'E_IMAGE_SEARCH_DESCRIPTION',
      status: 502,
    })
  }
}
