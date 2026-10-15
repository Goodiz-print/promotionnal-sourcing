import { Exception } from '@adonisjs/core/exceptions'

/**
 * La cérémonie WebAuthn n'a pas abouti : défi absent ou périmé, réponse
 * illisible, signature invalide, passkey inconnue ou compteur incohérent.
 * Volontairement unique et générique — ne jamais indiquer à un visiteur si une
 * passkey existe. Toujours interceptée dans le controller (erreur de champ +
 * redirection).
 */
export class PasskeyVerificationFailedException extends Exception {
  static status = 400
  static code = 'E_PASSKEY_VERIFICATION_FAILED'
  static message = 'The passkey could not be verified'
}

/** Cette passkey (même authentificateur) est déjà enregistrée sur la plateforme. */
export class PasskeyAlreadyRegisteredException extends Exception {
  static status = 422
  static code = 'E_PASSKEY_ALREADY_REGISTERED'
  static message = 'This passkey is already registered'
}
