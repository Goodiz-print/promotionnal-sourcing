import { Exception } from '@adonisjs/core/exceptions'

/**
 * Seed lancé en production (staging compris) sans `SEED_DEMO_PASSWORD`, ou avec
 * une valeur trop courte : les comptes de démo auraient un mot de passe faible
 * sur une URL publique.
 */
export class DemoPasswordMissingException extends Exception {
  static status = 500
  static code = 'E_DEMO_PASSWORD_MISSING'
  static message =
    'SEED_DEMO_PASSWORD must be set (12 characters or more) to seed demo accounts in production'
}
