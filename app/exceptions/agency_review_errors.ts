import { Exception } from '@adonisjs/core/exceptions'

/** Inscription agence introuvable (organisation inconnue ou sans profil agence). */
export class AgencyReviewNotFoundException extends Exception {
  static status = 404
  static code = 'E_AGENCY_REVIEW_NOT_FOUND'
  static message = 'Agency review not found'
}

/** Décision sur une agence qui n'est plus à revoir (déjà traitée ou archivée). */
export class AgencyReviewClosedException extends Exception {
  static status = 409
  static code = 'E_AGENCY_REVIEW_CLOSED'
  static message = 'Agency review is already closed'
}
