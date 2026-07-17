import { Exception } from '@adonisjs/core/exceptions'

/**
 * Levee quand la generation d'un embedding echoue : cle Mistral absente,
 * appel API en erreur, ou reponse sans vecteur exploitable.
 */
export class EmbeddingGenerationError extends Exception {
  static status = 500
  static code = 'E_EMBEDDING_GENERATION_FAILED'
}
