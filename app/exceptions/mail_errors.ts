import { Exception } from '@adonisjs/core/exceptions'

/**
 * `SendMailJob` a reçu une charge dont le `kind` n'est pas géré : job dispatché
 * par une version plus récente du code, ou charge corrompue en base. Le job
 * échoue (et sera rejoué puis loggué par `failed()`) plutôt que d'avaler le mail
 * en silence.
 */
export class UnknownMailKindException extends Exception {
  static status = 500
  static code = 'E_UNKNOWN_MAIL_KIND'

  constructor(kind: string) {
    super(`Unknown transactional mail kind "${kind}"`)
  }
}
