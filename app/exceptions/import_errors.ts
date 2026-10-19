import { Exception } from '@adonisjs/core/exceptions'

/**
 * Transition interdite pour un import (ex. terminer un import qui n'a pas démarré).
 */
export class ImportJobStateException extends Exception {
  static status = 422
  static code = 'E_IMPORT_JOB_STATE'
  static message = 'This import cannot change state from its current status'
}
